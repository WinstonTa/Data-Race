# Data Race — Handoff Brief

_Last updated 2026-09-14. Read this before touching code; it replaces an hour of repo spelunking._

## 1. What this is

**Data Race** is a client-only web app: drop a wide-format CSV → edit entities in a table → preview an animated bar chart race at 60 fps on a 16:9 canvas → export a 1080p **MP4 (H.264 via WebCodecs)** or **PNG**. No backend, no server rendering; it ships as a Next.js static export (`out/`) and deploys to Vercel.

The MVP is **feature-complete and verified** (see §6). Remaining work is polish, deployment, and whatever new features Winston asks for.

## 2. Locked product decisions (do not re-litigate)

| Topic        | Decision                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| CSV input    | **Wide only**: `Name, [Category], [Image], <period>, <period>, …`. Long/tidy format is out of scope.                                |
| Time axis    | Uniform per period; headers are raw string labels (no date parsing).                                                                |
| Speed        | `secondsPerPeriod` (default 0.5 s). Total length = (periods − 1) × spp.                                                             |
| Motion       | Smooth: lerp **value and rank** between keyframes.                                                                                  |
| Missing data | **Last-value retention.** Entity is absent until its first non-null value, then holds the last known value through gaps to the end. |
| Colors       | Palette per entity; a `Category` column makes entities share a color. All overridable in the table.                                 |
| Chrome       | Title, subtitle, big period label, value labels, source/caption line.                                                               |
| Top N        | Configurable (3–25), default 10. Horizontal bars only.                                                                              |
| Export       | PNG + MP4 at **1080p, 30 or 60 fps**. No 4K, no audio.                                                                              |
| Browsers     | Chrome/Edge primary. WebCodecs-without-H.264 → WebM/VP9 fallback. No WebCodecs → notice. Preview + PNG work everywhere.             |
| Persistence  | Single auto-saved project in IndexedDB + `.datarace.json` save/open. No multi-project gallery.                                      |
| Video lib    | `mediabunny` (successor to `mp4-muxer`). Never `captureStream`/`MediaRecorder`.                                                     |
| Table lib    | Plain shadcn `Table` + controlled inputs. TanStack Table was dropped (v9 API rewrite, no payoff for ~15 rows).                      |

## 3. Tech stack

- **Next.js 16.3** (App Router, Turbopack, `output: 'export'`), React 19, TypeScript 5 strict
- **Tailwind 4 + shadcn/ui** (radix-nova preset, `cn` from the `cn` package, icons from `lucide-react`)
- **zustand 5** (+ `persist` with an `idb-keyval` IndexedDB adapter)
- **papaparse**, **d3-scale / d3-array / d3-format** (no d3-interpolate — plain lerp)
- **mediabunny** (WebCodecs `VideoEncoder` + MP4/WebM muxing, handles backpressure)
- **react-dropzone**, **Vitest 5**, Prettier (+ tailwind plugin), ESLint (next config)
- **pnpm 12**, deploy target Vercel

## 4. Architecture in one picture

```
 Presentation ('use client')             Core (pure TS — NO react/next/DOM imports)
 ┌──────────────────────────┐            ┌──────────────────────────────────────┐
 │ Workspace                │ actions    │ parser/    CSV → Dataset + warnings  │
 │  ├ CsvDropzone           │──────────▶ │ timeline/  buildKeyframes, frameAt   │
 │  ├ TableEditor           │            │ render/    renderFrame (Canvas2D,    │
 │  ├ SettingsPanel         │            │            1920×1080 logical space)  │
 │  └ HealthAlerts          │            │ export/    codec probe, PNG, video   │
 │ Player (Viewport+Scrub)  │◀── reads ──└──────────────┬───────────────────────┘
 │ ExportDialog             │                            │ used identically by
 └────────────┬─────────────┘                            ▼
              │ zustand stores          main-thread preview   ⇄   workers/export.worker.ts
              ▼                         (HTMLCanvas + rAF)        (OffscreenCanvas + WebCodecs)
   useProjectStore (persist→IDB) · usePlaybackStore (t, playing, speed) · useAssetStore (ImageBitmaps)
```

**The invariant that makes everything work:** `frameAt(ctx, t)` in `src/core/timeline/frameAt.ts` is the single source of truth for what is on screen. Preview calls it from `requestAnimationFrame` with wall-clock `t`; the exporter calls it with `t = frame / fps / secondsPerPeriod`. The renderer always draws into a fixed **1920×1080 logical space** and the caller sets the canvas transform. Same `t` → same pixels, preview and export are pixel-identical by construction.

**`src/core` must stay DOM/React-free** — the same modules run inside the export worker.

## 5. Repository map

```
Data-Race/
├── AGENTS.md / CLAUDE.md        Agent instructions (this file is linked from there)
├── docs/HANDOFF.md              ← you are here
├── README.md                    User-facing docs (CSV format, scripts, browser support)
├── next.config.ts               output:'export', images.unoptimized
├── vitest.config.mts            node env, alias @ → src, tests = src/**/*.test.ts
├── components.json              shadcn config (style radix-nova, neutral base)
├── .claude/launch.json          "dev" config for the in-app browser (pnpm dev on :3000)
├── public/fonts/                Inter variable woff2 (latin + latin-ext) + license.
│                                Served from /public so the WORKER can load the same
│                                files via FontFace. Family name: "Inter Chart".
└── src/
    ├── app/
    │   ├── layout.tsx           Geist UI font vars, <TooltipProvider>, metadata
    │   ├── globals.css          Tailwind + shadcn tokens + @font-face "Inter Chart"
    │   └── page.tsx             <ErrorBoundary><Workspace/></ErrorBoundary>
    │
    ├── core/                    ★ PURE. Unit-tested. Shared by preview + worker.
    │   ├── types.ts             Entity, Dataset, HealthWarning, ChartSettings (+DEFAULT_SETTINGS),
    │   │                        Keyframe, BarState, FrameState
    │   ├── parser/
    │   │   ├── parseWideCsv.ts  Entry point. PapaParse (header:false) → detectColumns →
    │   │   │                    entities → assignColors → sanitize. Never throws on bad data.
    │   │   ├── detectColumns.ts Col 0 = name; /category|group|…/ ; /image|icon|flag|…/ ; rest = periods
    │   │   ├── parseNumber.ts   "$1,234", "45%", "(300)", "1.2e6" → number; isBlank() for n/a/-/""
    │   │   └── sanitize.ts      Warnings: non-numeric, empty-row (sets included=false),
    │   │                        duplicate-name, no-period-columns, no-rows
    │   ├── timeline/
    │   │   ├── buildKeyframes.ts  Per period: retained value + integer rank (all present
    │   │   │                      entities, not just top N) + maxValue
    │   │   ├── frameAt.ts         frameAt(), indexEntities(), totalDurationSeconds().
    │   │   │                      Absent side of a lerp → rank=topN, value=0 (slides in/out
    │   │   │                      from below). opacity = clamp(topN − rank, 0, 1).
    │   │   │                      periodLabel = periods[round(t)].
    │   │   └── lerp.ts            lerp, clamp
    │   ├── render/
    │   │   ├── renderFrame.ts   createRenderer(ctx) → { render(frame, settings, assets), invalidate() }
    │   │   │                    Draws bg, title/subtitle, ticks (scaleLinear, domain = xMax×1.05,
    │   │   │                    NO .nice() so the axis never jumps), bars, labels, values,
    │   │   │                    circular icons, period label, source line.
    │   │   ├── layout.ts        LOGICAL_WIDTH/HEIGHT (1920×1080), PADDING, FONTS, computeLayout(),
    │   │   │                    barFonts(). Name labels live in a right-aligned gutter left of bars.
    │   │   ├── drawBar.ts       Ctx2D type, roundedRectPath, drawCircularImage (object-fit: cover)
    │   │   ├── textCache.ts     TextMeasurer: memoized measureText + fit() ellipsis
    │   │   ├── fonts.ts         CHART_FONT_FAMILY, chartFont(weight,size), loadChartFonts(fontSet, origin)
    │   │   └── palette.ts       DEFAULT_PALETTE (20 colors), assignColors(entities)
    │   └── export/
    │       ├── codecSupport.ts  probeExportPlan(w,h) → {codec:'avc'|'vp9', container, ext, label} | null
    │       ├── exportVideo.ts   exportVideo(canvas, job, assets, onProgress, signal) → Blob.
    │       │                    Deterministic loop: render frame f → await source.add(f/fps, 1/fps).
    │       │                    videoFrameCount() = round(seconds×fps)+1. 12 Mbps @1080p.
    │       └── exportPng.ts     exportPng(frameCtx, settings, assets, t) → PNG Blob via OffscreenCanvas
    │
    ├── workers/
    │   └── export.worker.ts     Message protocol {start|cancel} → {progress|done|error}.
    │                            Loads Inter via self.fonts, runs exportVideo on an OffscreenCanvas.
    │
    ├── stores/
    │   ├── useProjectStore.ts   dataset, settings, sourceName + loadDataset/loadProject/updateEntity/
    │   │                        updateSettings/clear. persist(name 'data-race-project', IDB storage,
    │   │                        skipHydration:true — hydration is triggered by useProjectBoot).
    │   ├── usePlaybackStore.ts  t (period units), playing, speed. NOT persisted.
    │   └── useAssetStore.ts     bitmaps: Map<imageId, ImageBitmap> (renderer input) +
    │                            urls: Map<imageId, objectURL> (table thumbnails). Closes/revokes on replace.
    │
    ├── lib/
    │   ├── idbStorage.ts        zustand StateStorage over idb-keyval (db 'data-race', store 'project')
    │   ├── assets.ts            Image blobs in IDB (db 'data-race-assets'): addImage(file)→id,
    │   │                        removeImage, getImageBlob, putImageBlob, hydrateImages(keepIds)
    │   │                        (also deletes orphans). Bitmaps resized to ≤256px on decode.
    │   ├── projectFile.ts       saveProjectFile() / openProjectFile(file): {app:'data-race', version:1,
    │   │                        dataset, settings, sourceName, images:{id: dataURL}}. Re-keys images on open.
    │   ├── exportClient.ts      startVideoExport(job, bitmaps, onProgress) → {result: Promise<Blob>, cancel}.
    │   │                        Spawns the worker (new Worker(new URL('../workers/export.worker.ts',
    │   │                        import.meta.url), {type:'module'})), clones bitmaps before transfer.
    │   ├── download.ts          downloadBlob(blob, name), baseName(fileName)
    │   └── utils.ts             cn() re-export (shadcn)
    │
    ├── data/
    │   └── sampleDataset.ts     Deterministic fictional "coffee chains" CSV (seeded PRNG),
    │                            SAMPLE_FILE_NAME, SAMPLE_SETTINGS, loadSampleDataset()
    │
    └── components/
        ├── ErrorBoundary.tsx    Class boundary with "Try again" / "Reset project"
        ├── ui/                  shadcn generated: button dialog input label slider select tabs alert
        │                        tooltip popover progress switch table badge separator scroll-area
        ├── workspace/
        │   ├── Workspace.tsx    Page shell. useProjectBoot() gate; header (ProjectMenu + ExportDialog),
        │   │                    CsvDropzone, HealthAlerts, grid [Player | SettingsPanel], TableEditor.
        │   │                    Player and ExportDialog are next/dynamic({ssr:false}).
        │   ├── useProjectBoot.ts  ★ bootProject() singleton: persist.rehydrate() → load sample if
        │   │                    empty → hydrateImages(). MUST stay a singleton (see §7 #1).
        │   ├── CsvDropzone.tsx  react-dropzone; parses, resets playback, sets title from filename,
        │   │                    clears subtitle/source. "Load sample" button.
        │   ├── TableEditor.tsx  Rows: Show switch · color input · Name · Category · Icon upload/remove ·
        │   │                    read-only period values.
        │   ├── SettingsPanel.tsx  title/subtitle/source, topN, secondsPerPeriod, numberFormat
        │   │                    (d3-format spec), bg/text color, corner radius
        │   ├── HealthAlerts.tsx Groups dataset.warnings by kind; blocking kinds are destructive alerts
        │   └── ProjectMenu.tsx  Open project (.json) / Save project buttons
        ├── player/
        │   ├── Player.tsx       Mounts usePlayback + useKeyboardShortcuts; <Viewport/><ScrubControls/>
        │   ├── Viewport.tsx     aspect-video container, DPR-scaled canvas, ResizeObserver.
        │   │                    Draws from a usePlaybackStore.subscribe() so React does NOT
        │   │                    re-render per frame. Invalidates text cache after document.fonts loads.
        │   ├── usePlayback.ts   rAF loop: t += dt / spp × speed; dt clamped to 0.1 s; pauses at end;
        │   │                    restarts from 0 if play pressed at end.
        │   ├── useFrameContext.ts  useMemo(buildKeyframes + indexEntities) keyed on dataset/topN
        │   ├── useKeyboardShortcuts.ts  Space, ←/→ (step period), Home/End. Ignored in inputs/dialogs.
        │   └── ScrubControls.tsx  Restart, play/pause, slider (step 0.01), period + elapsed readout, speed
        └── export/
            └── ExportDialog.tsx Tabs: Video (probe plan → fps select → progress/cancel → download)
                                 and PNG snapshot (current t).
```

**Tests** (`pnpm test`, 57 passing): `core/parser/*.test.ts`, `core/timeline/timeline.test.ts`, `core/render/textCache.test.ts`. Pattern: pure functions with fixture data; parser tests inject `idFactory` for deterministic ids.

## 6. Verified so far (2026-09-13, Chrome via the in-app browser)

- Parser: BOM, CRLF, quoted commas, currency/percent/accounting, `n/a`, non-numeric flagged, empty rows excluded, duplicates warned, image column ignored with notice.
- Preview: renders sample on first load; play/scrub/speed/keyboard; bars slide & re-rank smoothly; entity edits (name/color/show) and settings update live.
- Persistence: title, entity edits, and uploaded icons survive multiple reloads. Orphaned image blobs get cleaned on boot.
- Export: 211-frame 1080p30 MP4 in ~2–5 s (4.5 MB), decodes as 1920×1080 / 7.03 s, mid-video frame matches preview (Inter font loaded in worker, icon composited). PNG 1920×1080. Cancel mid-render leaves no error/output. **Also verified against the production `out/` static build** served on a plain HTTP server — worker chunk resolves correctly.
- `pnpm test` / `typecheck` / `lint` / `format` / `build` all clean.

**Not verified:** WebM fallback and "unsupported" notice paths (only Chrome was available); real browser download UX (downloads were intercepted in the sandbox); Vercel deploy.

## 7. Gotchas & hard-won knowledge

1. **Boot must be a singleton.** React StrictMode double-mounts effects → two concurrent `persist.rehydrate()` calls; the first resolves before hydration finishes, sees an empty store, and overwrites the saved project with the sample. `bootProject()` in `useProjectBoot.ts` guards this with a module-level promise. Don't call `rehydrate()` anywhere else.
2. **zustand selectors must return stable references.** `s.dataset?.periods ?? []` triggers "getServerSnapshot should be cached" infinite-loop errors. Use module-level constants (`NO_PERIODS`, `NO_WARNINGS`).
3. **`ssr: false` dynamic imports only work inside client components** in Next 16. `Workspace.tsx` is the client boundary that dynamically imports `Player` and `ExportDialog`.
4. **Worker fonts:** the worker can't see CSS `@font-face`. `loadChartFonts(self.fonts, origin)` loads the same `/fonts/*.woff2` files. Keep `fonts.ts` unicode ranges in sync with `globals.css`.
5. **Transferring an ImageBitmap detaches it.** `exportClient.ts` clones via `createImageBitmap(bmp)` before `postMessage(..., [bitmaps])`; the worker closes its copies in `finally`.
6. **Axis uses `xMax × 1.05` without `.nice()`** on purpose — nicing snaps the domain and makes bars visibly jump between frames.
7. **`out/` locks on Windows** while something serves it (EBUSY on `next build`). Stop any static server before rebuilding.
8. **The in-app browser pane throttles rAF**, so preview speed looks slow there. The `dt ≤ 0.1 s` clamp in `usePlayback` is why; real browsers are fine. Use `resize_window` 1400×1000 for screenshots, or inspect via `javascript_tool`.
9. `next dev` re-adds the auto-generated block at the top of `AGENTS.md`. Leave it; project instructions go below it.
10. `mediabunny` typings live in `node_modules/mediabunny/dist/mediabunny.d.ts`; Next 16 docs in `node_modules/next/dist/docs/` (read before using unfamiliar Next APIs — the framework has changed from training data).

## 8. Suggested next steps (not yet requested — confirm with Winston first)

- Commit the uncommitted work on `feature/mvp`, open PR to `main`, deploy to Vercel.
- Test in Firefox/Safari for the WebM fallback + notice.
- Polish candidates: gridline fade when tick set changes; per-category legend; "step" motion toggle; 4K export (needs codec probe at 3840×2160 and bitrate scaling — already parametrised in `exportVideo.ts`); image-URL column support (fetch + CORS).
- Playwright smoke test for the export path so regressions are caught outside a manual browser session.

## 9. Commands

```bash
pnpm dev          # http://localhost:3000 (or the in-app browser "dev" launch config)
pnpm test         # vitest run
pnpm typecheck    # tsc --noEmit  (needs a prior `next build`/`dev` for generated Next types)
pnpm lint
pnpm format
pnpm build        # static export → out/
```
