# Data Race — Handoff Brief

_Last updated 2026-10-03. Read this before touching code; it replaces an hour of repo spelunking._

## 1. What this is

**Data Race** is a client-only web app: drop a wide-format CSV → confirm/fix the column mapping and edit cells in a table → preview an animated bar chart race at 60 fps on a 16:9 canvas → export a 1080p **MP4 (H.264 via WebCodecs)** or **PNG**. No backend, no server rendering; it ships as a Next.js static export (`out/`) and deploys to Vercel.

The MVP is **feature-complete and verified** (see §6). Remaining work is polish, deployment, and whatever new features Winston asks for.

A second, independent workspace lives at **`/graph`** (added 2026-10-03, branch `feature/graphview`): drop a Discord friends **edge-list CSV** → force-directed network with Louvain groups, betweenness "bridges", per-friend metrics, search, sortable table, PNG + metrics-CSV export. It shares only UI primitives, `parseGrid`, `idbStorage`, `downloadBlob` and the palette with the bar race.

## 2. Locked product decisions (do not re-litigate)

| Topic        | Decision                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSV input    | **Wide only**: one row per entity, one column per period. Long/tidy format is out of scope. Header row / name / category / period columns are auto-guessed and user-mappable (branch `fix/data_input`, 2026-09-15).                                                                                                                                                                                       |
| Time axis    | Uniform per period; headers are raw string labels (no date parsing).                                                                                                                                                                                                                                                                                                                                      |
| Speed        | `secondsPerPeriod` (default 0.5 s). Total length = (periods − 1) × spp.                                                                                                                                                                                                                                                                                                                                   |
| Motion       | Smooth: lerp **value and rank** between keyframes.                                                                                                                                                                                                                                                                                                                                                        |
| Missing data | **Last-value retention.** Entity is absent until its first non-null value, then holds the last known value through gaps to the end.                                                                                                                                                                                                                                                                       |
| Colors       | Palette per entity; a `Category` column makes entities share a color. All overridable in the table.                                                                                                                                                                                                                                                                                                       |
| Chrome       | Title, subtitle, big period label, value labels, source/caption line.                                                                                                                                                                                                                                                                                                                                     |
| Top N        | Configurable (3–25), default 10. Horizontal bars only.                                                                                                                                                                                                                                                                                                                                                    |
| Export       | PNG + MP4 at **1080p, 30 or 60 fps**. No 4K, no audio.                                                                                                                                                                                                                                                                                                                                                    |
| Browsers     | Chrome/Edge primary. WebCodecs-without-H.264 → WebM/VP9 fallback. No WebCodecs → notice. Preview + PNG work everywhere.                                                                                                                                                                                                                                                                                   |
| Persistence  | Single auto-saved project in IndexedDB + `.datarace.json` save/open. No multi-project gallery.                                                                                                                                                                                                                                                                                                            |
| Video lib    | `mediabunny` (successor to `mp4-muxer`). Never `captureStream`/`MediaRecorder`.                                                                                                                                                                                                                                                                                                                           |
| Table lib    | Plain `<table>` + click-to-edit cells, 50 rows/page, no virtualisation dep. TanStack Table was dropped (v9 API rewrite).                                                                                                                                                                                                                                                                                  |
| Grid model   | The raw CSV grid + `ColumnMapping` are the source of truth (persisted, in project file v2); `Dataset` is derived via `buildDataset`.                                                                                                                                                                                                                                                                      |
| Friend graph | Separate `/graph` route. Input is a Discord **edge list** (`Friend_ID…Mutual_DisplayName`); wide-only applies to the bar race only. Sigma.js v3 + graphology. Ego (account owner) excluded from metrics; "Show me" adds a visual-only node. Min-degree slider is visibility-only (metrics on the full graph). Auto-saved to IDB key `data-race-graph`; exports = PNG of the view + metrics CSV. No video. |

## 3. Tech stack

- **Next.js 16.3** (App Router, Turbopack, `output: 'export'`), React 19, TypeScript 5 strict
- **Tailwind 4 + shadcn/ui** (radix-nova preset, `cn` from the `cn` package, icons from `lucide-react`)
- **zustand 5** (+ `persist` with an `idb-keyval` IndexedDB adapter)
- **papaparse**, **d3-scale / d3-array / d3-format** (no d3-interpolate — plain lerp)
- **mediabunny** (WebCodecs `VideoEncoder` + MP4/WebM muxing, handles backpressure)
- **react-dropzone**, **Vitest 5**, Prettier (+ tailwind plugin), ESLint (next config)
- Friend graph: **graphology** (+ `-communities-louvain`, `-metrics`, `-layout`, `-layout-forceatlas2`), **sigma 3**, `@sigma/node-border` (bridge rings), `@sigma/export-image` (PNG)
- **pnpm 12**, deploy target Vercel

## 4. Architecture in one picture

```
 Presentation ('use client')             Core (pure TS — NO react/next/DOM imports)
 ┌──────────────────────────┐            ┌──────────────────────────────────────┐
 │ Workspace                │ actions    │ parser/    CSV → Grid → mapping →    │
 │  ├ CsvDropzone           │──────────▶ │            Dataset + warnings        │
 │  ├ TableEditor/GridTable │            │ timeline/  buildKeyframes, frameAt   │
 │  ├ TableEditor           │            │ render/    renderFrame (Canvas2D,    │
 │  ├ SettingsPanel         │            │            1920×1080 logical space)  │
 │  └ HealthAlerts          │            │ export/    codec probe, PNG, video   │
 │ Player (Viewport+Scrub)  │◀── reads ──└──────────────┬───────────────────────┘
 │ ExportDialog             │                            │ used identically by
 └────────────┬─────────────┘                            ▼
              │ zustand stores          main-thread preview   ⇄   workers/export.worker.ts
              ▼                         (HTMLCanvas + rAF)        (OffscreenCanvas + WebCodecs)
   useProjectStore (source grid+mapping, dataset; persist→IDB) · usePlaybackStore (t, playing, speed) · useAssetStore (ImageBitmaps)
```

**The invariant that makes everything work:** `frameAt(ctx, t)` in `src/core/timeline/frameAt.ts` is the single source of truth for what is on screen. Preview calls it from `requestAnimationFrame` with wall-clock `t`; the exporter calls it with `t = frame / fps / secondsPerPeriod`. The renderer always draws into a fixed **1920×1080 logical space** and the caller sets the canvas transform. Same `t` → same pixels, preview and export are pixel-identical by construction.

**`src/core` must stay DOM/React-free** — the same modules run inside the export worker.

**Data flow for input (added 2026-09-15):** `parseGrid(text)` → `Grid` (raw cells, rectangular, nothing interpreted) → `suggestMapping(grid)` → `ColumnMapping {headerRow, nameCol, categoryCol?, periodCols}` → `buildDataset(grid, mapping, {prev})` → `Dataset`. The store keeps `source = {grid, mapping}` and rebuilds `dataset` on every mapping change or cell edit; `prev` matches entities by `sourceRow` so ids, colours, icons and Show toggles survive rebuilds. Everything downstream of `Dataset` (timeline, renderer, exporter, worker) is unchanged.

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
    │   ├── types.ts             Entity (+sourceRow), Dataset, Grid, ColumnMapping, HealthWarning,
    │   │                        ChartSettings (+DEFAULT_SETTINGS), Keyframe, BarState, FrameState
    │   ├── parser/
    │   │   ├── grid.ts          parseGrid(text) → Grid (BOM strip, blank lines dropped, ragged rows
    │   │   │                    padded); gridToCsv(grid); datasetToGrid(dataset) for legacy data
    │   │   ├── columnMapping.ts profileColumns (nonBlank/numeric/unique per column), guessHeaderRow
    │   │   │                    (most non-blank cells in first 25 rows), suggestMapping → {mapping,
    │   │   │                    confident}, isPeriodCandidate (≥80 % numeric), normalizeMapping
    │   │   ├── buildDataset.ts  Grid + mapping → Dataset. Carries id/color/imageId/included over
    │   │   │                    from `prev` by sourceRow. Warnings: rows-above-header, unused-columns,
    │   │   │                    mapping-uncertain (only when opts.uncertain) + sanitize's
    │   │   ├── chartReadyGrid.ts toChartReadyGrid(grid, mapping) → `Name,[Category],periods…` grid
    │   │   ├── parseWideCsv.ts  Thin one-shot wrapper: parseGrid → suggestMapping → buildDataset
    │   │   ├── parseNumber.ts   "$1,234", "45%", "(300)", "1.2e6" → number; isBlank() for n/a/-/""
    │   │   ├── sanitize.ts      Warnings: non-numeric, empty-row (sets included=false),
    │   │   │                    duplicate-name, no-period-columns, no-rows
    │   │   └── worldbank.fixture.ts  Trimmed World Bank "API_*" CSV (preamble, 4 text cols,
    │   │                        trailing empty col) used by the mapping tests
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
    │   ├── random.ts            mulberry32(seed) PRNG (sample data + seeded Louvain)
    │   ├── graph/               ★ Friend graph, pure + tested
    │   │   ├── types.ts         FriendNode/FriendEdge/GraphData (ids are STRINGS), NodeMetrics,
    │   │   │                    CommunityInfo, GraphSummary, GraphAnalysis, nodeLabel()
    │   │   ├── parseEdgeList.ts Grid → {data, warnings}: header match is case/separator-insensitive,
    │   │   │                    undirected dedup (A→B + B→A is normal; only exact repeated rows
    │   │   │                    warn), self-loops dropped, empty Mutual_ID keeps isolates
    │   │   ├── buildGraph.ts    toGraphology(data) → UndirectedGraph
    │   │   ├── metrics.ts       analyzeGraph(data,{seed}): degree, local clustering (hand-rolled),
    │   │   │                    normalized betweenness, seeded Louvain renumbered largest-first,
    │   │   │                    ≤2-member groups → grey "Other", isolates → community null,
    │   │   │                    bridge = top-10 % betweenness AND neighbours in ≥2 communities
    │   │   └── metricsCsv.ts    metricsToGrid(data, analysis) for the Metrics CSV export
    │   └── export/
    │       ├── codecSupport.ts  probeExportPlan(w,h) → {codec:'avc'|'vp9', container, ext, label} | null
    │       ├── exportVideo.ts   exportVideo(canvas, job, assets, onProgress, signal) → Blob.
    │       │                    Deterministic loop: render frame f → await source.add(f/fps, 1/fps).
    │       │                    videoFrameCount() = round(seconds×fps)+1. 12 Mbps @1080p.
    │       └── exportPng.ts     exportPng(frameCtx, settings, assets, t) → PNG Blob via OffscreenCanvas
    │
    ├── workers/
    │   ├── export.worker.ts     Message protocol {start|cancel} → {progress|done|error}.
    │   │                        Loads Inter via self.fonts, runs exportVideo on an OffscreenCanvas.
    │   └── graph.worker.ts      {analyze, data} → {done, analysis}|{error}; runs analyzeGraph
    │                            (betweenness is O(V·E), too slow for the main thread).
    │
    ├── stores/
    │   ├── useProjectStore.ts   source {grid, mapping}, dataset, settings, sourceName.
    │   │                        loadSource(grid) / setMapping / setCell (both rebuild via buildDataset
    │   │                        with prev) / loadProject / updateEntity / setIncludedMany / updateSettings /
    │   │                        clear. persist v2 (IDB, skipHydration:true — hydration is triggered by
    │   │                        useProjectBoot); `merge` synthesises `source` for v1 saves via datasetToGrid.
    │   ├── useGraphStore.ts     Friend graph: data, warnings, sourceName, positions, settings
    │   │                        {minDegree, repulsion, showEgo} persisted (IDB key data-race-graph,
    │   │                        skipHydration). Session-only: analysis, selectedId, focusNonce
    │   │                        (camera → node), layoutNonce (re-run layout), layoutRunning.
    │   ├── usePlaybackStore.ts  t (period units), playing, speed. NOT persisted.
    │   └── useAssetStore.ts     bitmaps: Map<imageId, ImageBitmap> (renderer input) +
    │                            urls: Map<imageId, objectURL> (table thumbnails). Closes/revokes on replace.
    │
    ├── lib/
    │   ├── idbStorage.ts        zustand StateStorage over idb-keyval (db 'data-race', store 'project')
    │   ├── assets.ts            Image blobs in IDB (db 'data-race-assets'): addImage(file)→id,
    │   │                        removeImage, getImageBlob, putImageBlob, hydrateImages(keepIds)
    │   │                        (also deletes orphans). Bitmaps resized to ≤256px on decode.
    │   ├── projectFile.ts       saveProjectFile() / openProjectFile(file): {app:'data-race', version:2,
    │   │                        dataset, source, settings, sourceName, images:{id: dataURL}}. Opens v1
    │   │                        (no source) too. downloadCsv(grid, name). Re-keys images on open.
    │   ├── loadCsv.ts           loadCsvText(text, fileName): parseGrid → store.loadSource → rewind
    │   │                        playback. Used by the dropzone, "Load sample" and first-visit boot.
    │   ├── loadEdgeList.ts      loadEdgeListText(text, name): parseGrid → parseEdgeList → graph store
    │   ├── graphAnalysisClient.ts  analyzeInWorker(data) → {result, cancel} (spawns graph.worker)
    │   ├── exportClient.ts      startVideoExport(job, bitmaps, onProgress) → {result: Promise<Blob>, cancel}.
    │   │                        Spawns the worker (new Worker(new URL('../workers/export.worker.ts',
    │   │                        import.meta.url), {type:'module'})), clones bitmaps before transfer.
    │   ├── download.ts          downloadBlob(blob, name), baseName(fileName)
    │   └── utils.ts             cn() re-export (shadcn)
    │
    ├── data/
    │   ├── sampleDataset.ts     Deterministic fictional "coffee chains" CSV (seeded PRNG):
    │   │                        buildSampleCsv(), SAMPLE_FILE_NAME, SAMPLE_SETTINGS
    │   └── sampleFriendGraph.ts Deterministic fictional Discord export: 61 friends, 5 groups,
    │                            4 planted bridges, 4 isolates; buildSampleFriendCsv()
    │
    └── components/
        ├── ErrorBoundary.tsx    Class boundary with "Try again" / "Reset project"
        ├── AppNav.tsx           next/link tabs "Bar race" (/) ↔ "Friend graph" (/graph)
        ├── ui/                  shadcn generated: button dialog input label slider select tabs alert
        │                        tooltip popover progress switch table badge separator scroll-area
        ├── workspace/
        │   ├── Workspace.tsx    Page shell. useProjectBoot() gate; header (ProjectMenu + ExportDialog),
        │   │                    CsvDropzone, HealthAlerts, grid [Player | SettingsPanel], TableEditor.
        │   │                    Player and ExportDialog are next/dynamic({ssr:false}).
        │   ├── useProjectBoot.ts  ★ bootProject() singleton: persist.rehydrate() → load sample if
        │   │                    empty → hydrateImages(). MUST stay a singleton (see §7 #1).
        │   ├── CsvDropzone.tsx  react-dropzone; loadCsvText, sets title from filename,
        │   │                    clears subtitle/source. "Load sample" button.
        │   ├── TableEditor.tsx  Column setup bar (header row / name / category selects, period count
        │   │                    + "Select numeric columns"/Clear), summary line, name filter with
        │   │                    Hide/Show-matching bulk toggles, 50-row pager, "Edited CSV" and
        │   │                    "Chart-ready CSV" downloads. Renders <GridTable/>. id="column-setup".
        │   ├── GridTable.tsx    The raw grid: header <th> per column with role badge / Period
        │   │                    checkbox / "n/m numeric" hint; rows above the header dimmed +
        │   │                    read-only; header row highlighted; data rows get Show/Color/Icon
        │   │                    controls. Click-to-edit cells (one <Input> mounted at a time; Enter/
        │   │                    blur commit, Esc cancels). Non-numeric period cells red-tinted. Only
        │   │                    the name column is sticky-left (see §7 #11).
        │   ├── IconCell.tsx     Icon upload/replace/remove for one entity (was inside TableEditor).
        │   ├── SettingsPanel.tsx  title/subtitle/source, topN, secondsPerPeriod, numberFormat
        │   │                    (d3-format spec), bg/text color, corner radius
        │   ├── HealthAlerts.tsx Compact: one alert per kind in a fixed order, per-item kinds collapsed
        │   │                    in <details>; "mapping-uncertain" / "no-period-columns" get an
        │   │                    "Open column setup" button that scrolls to #column-setup
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
        ├── graph/               Friend graph workspace (route src/app/graph/page.tsx)
        │   ├── GraphWorkspace.tsx  Client boundary: bootGraph gate, useGraphAnalysis, header (nav +
        │   │                    GraphExportButtons), EdgeListDropzone, GraphWarnings, SummaryStats,
        │   │                    grid [GraphCanvas | side panel], NodeTable. GraphCanvas is ssr:false.
        │   ├── useGraphBoot.ts  ★ bootGraph() singleton: rehydrate graph store → sample if empty
        │   ├── useGraphAnalysis.ts  Runs the worker when `data` changes; stale jobs can't write back
        │   ├── GraphCanvas.tsx  Owns the Sigma instance + FA2 worker supervisor. Builds a display
        │   │                    graph from data+analysis (seeded community-blob positions unless
        │   │                    persisted ones exist); reducers read useGraphStore.getState() for
        │   │                    min-degree/selection/hover; a store.subscribe() drives refresh,
        │   │                    ego, re-layout and camera focus without React re-renders. Drag pins
        │   │                    nodes (fixed) and stops a running layout. ResizeObserver → resize.
        │   ├── sigmaRegistry.ts Live Sigma instance for PNG export / zoom buttons
        │   └── GraphControls, FriendSearch, NodeDetails, TopLists, SummaryStats, NodeTable,
        │                        GraphExportButtons, GraphWarnings, EdgeListDropzone, graphHooks
        └── export/
            └── ExportDialog.tsx Tabs: Video (probe plan → fps select → progress/cancel → download)
                                 and PNG snapshot (current t).
```

**Tests** (`pnpm test`, 99 passing): `core/parser/*.test.ts` (grid, columnMapping, buildDataset, chartReadyGrid, parseWideCsv, parseNumber), `core/timeline/timeline.test.ts`, `core/render/textCache.test.ts`, `core/graph/{parseEdgeList,metrics}.test.ts`. Pattern: pure functions with fixture data; parser tests inject `idFactory` for deterministic ids.

## 6. Verified so far (2026-09-13, Chrome via the in-app browser)

- Parser: BOM, CRLF, quoted commas, currency/percent/accounting, `n/a`, non-numeric flagged, empty rows excluded, duplicates warned, image column ignored with notice.
- Preview: renders sample on first load; play/scrub/speed/keyboard; bars slide & re-rank smoothly; entity edits (name/color/show) and settings update live.
- Persistence: title, entity edits, and uploaded icons survive multiple reloads. Orphaned image blobs get cleaned on boot.
- Export: 211-frame 1080p30 MP4 in ~2–5 s (4.5 MB), decodes as 1920×1080 / 7.03 s, mid-video frame matches preview (Inter font loaded in worker, icon composited). PNG 1920×1080. Cancel mid-render leaves no error/output. **Also verified against the production `out/` static build** served on a plain HTTP server — worker chunk resolves correctly.
- `pnpm test` / `typecheck` / `lint` / `format` / `build` all clean.

**2026-09-15, column mapping (Chrome via the in-app browser), using the real World Bank GDP export (`API_NY.GDP.MKTP.CD_DS2_en_csv_v2_*.csv`, 270 lines × 71 cols):** auto-mapping picks header row 3, `Country Name`, 66 period columns, leaves `Country Code`/`Indicator Name`/`Indicator Code` + the trailing empty column unused, reports 4 genuinely empty rows and zero non-numeric cells; chart renders 1960→2025. Verified: cell edit to `abc` → red cell + non-numeric warning, edit back clears it; unticking/reticking a period column and swapping the name column keep entity ids and a custom colour; filter "income" + Hide → 11 aggregates drop out of the chart; reload restores grid/mapping/colour/toggles from IDB (persist v2); Save → Open round-trips (575 KB), a v1 project file opens with a synthesised grid; "Edited CSV" = 268×71 with edits, "Chart-ready CSV" = `Name,1960…2025` × 265 rows; sample loads with `confident=true` and no alerts; 211-frame MP4 export still works.

**2026-10-03, friend graph (Chrome via the in-app browser, sample data):** analysis recovers all 5 planted groups (modularity 0.69) and flags the planted bridges; click/search/top-list/table selection opens the drawer and centres the camera with non-neighbours dimmed; click stage deselects; synthetic drag moves + pins a node without selecting it; min-degree 5 → 34 of 61 shown with the summary unchanged; repulsion change re-runs layout; Show me adds the You node + spokes; reload restores graph, positions, settings and colours without re-layout; PNG (1407×1223) and Metrics CSV (header + 61 rows, 18-digit ids intact) captured via a `URL.createObjectURL` hook; `/` ↔ `/graph` round trips leave one Sigma instance and no errors; the static `out/` build runs the analysis worker and the FA2 blob worker. **Not verified:** a real Discord export at scale (~1000 friends).

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
11. **Every `position: sticky` table cell is its own compositor layer.** Pinning row-number + controls + name (3 × 100 rows) made the grid table stall painting in Chrome. Only the name column is sticky now; keep it that way or virtualise.
12. **Period-column heuristic:** a column is auto-ticked only if ≥ 1 cell parses and ≥ 80 % of its non-blank cells parse. A column that is _all_ bad values (or all blank, like the World Bank trailing column) is left unticked with an "unused columns" note — the user can tick it by hand. `suggestMapping().confident` is false when the header isn't row 1, any non-blank column is unassigned, or > 5 % of period cells are unparsable; that drives the "Check the column setup" nudge, which `setMapping` clears and `setCell` preserves.
13. **`parseGrid` drops fully blank lines** (PapaParse `skipEmptyLines: "greedy"`), so the "Edited CSV" download of a file with blank lines has fewer rows than the original. Cells are otherwise verbatim.
14. **Entity ids are stable via `sourceRow`.** `buildDataset(..., { prev })` reuses the previous entity for the same grid row. A new row (e.g. typing a name into a previously blank name cell) gets a fresh id; blanking a row's name drops its entity and its colour/icon overrides with it.
15. **zustand `persist` re-serialises the whole grid on every `set`.** Fine for the 300 KB World Bank file; a multi-MB CSV would make each cell edit noticeably slow. Throttle persistence if that ever matters.
16. **Discord ids are strings end-to-end.** Snowflakes exceed 2^53; never `Number()` them or sort them numerically. `parseGrid` already keeps cells as text.
17. **`bootGraph()` is the graph store's only rehydrate path** (same StrictMode singleton reasoning as #1).
18. **Louvain is seeded** (`DEFAULT_ANALYSIS_SEED`) so groups and colours are stable across reloads; communities are renumbered largest-first, so "Group 1" is always the biggest.
19. **Sigma edge alpha is eaten by antialiasing.** ~1 px WebGL lines are mostly feather, so an rgba alpha of 0.2 renders near-invisible. Edges use `rgba(71,85,105,0.5)`. Verify edge colours by exporting a PNG and inspecting pixels, not with downscaled pane screenshots.
20. **Sigma only listens to `window.resize`.** `GraphCanvas` adds a ResizeObserver (skipping 0×0 sizes during route transitions, which throw) and sets `allowInvalidContainer`.
21. **The FA2 worker snapshots `fixed` at start** and overwrites positions while running, so dragging stops the layout first. Graph structure changes (ego toggle) respawn the FA2 worker automatically.
22. **Static export prefetch 404s locally.** Next 16 writes nested RSC segment files as folders (`out/graph/__next.graph/__PAGE__.txt`) but requests `/graph/__next.graph.__PAGE__.txt`; a plain `python -m http.server` 404s it (prefetch only, navigation still works). `/graph` is `out/graph.html` locally.

## 8. Suggested next steps (not yet requested — confirm with Winston first)

- Commit the uncommitted work on `feature/mvp`, open PR to `main`, deploy to Vercel.
- Test in Firefox/Safari for the WebM fallback + notice.
- Polish candidates: gridline fade when tick set changes; per-category legend; "step" motion toggle; 4K export (needs codec probe at 3840×2160 and bitrate scaling — already parametrised in `exportVideo.ts`); image-URL column support (fetch + CORS).
- Table editor follow-ups: "no header row" mode; add/delete rows; virtualised rows for very large files; throttled persistence (see §7 #15); a "hide aggregates" preset for World Bank files (their `Metadata_Country_*.csv` has a blank Region for aggregates).
- Friend graph follow-ups: test a real ~1000-friend export (betweenness + FA2 timing); community renaming; hide-isolates toggle; ego-network view (radius-1 subgraph of one friend); dark-mode canvas colours.
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
