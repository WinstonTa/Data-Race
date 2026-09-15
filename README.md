# Data Race

Turn a CSV into an animated bar chart race — edit it in the browser, preview at 60 fps, and export a 1080p MP4 or PNG. Everything runs client-side; there is no server.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. A fictional sample dataset loads on first visit; drop your own CSV to replace it.

## CSV format

Wide format, one row per entity and one column per period:

```csv
Name,Category,2000,2001,2002
Brazil,Americas,1200,1350,1500
Japan,Asia,4300,4200,4400
```

- The first column is the entity name.
- `Category` / `Group` (optional) groups entities so they share a color.
- Every other non-blank header is a period, kept in file order as a label.
- Numbers may contain `,` `$` `€` `%` or accounting parentheses. Blank / `n/a` cells are missing values: an entity holds its last known value until it gets a new one, and isn't shown until its first value.
- Rows with no numeric data are excluded and listed under health warnings.

## Scripts

| Command          | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `pnpm dev`       | Dev server                                     |
| `pnpm build`     | Static export to `out/` (deploys to any host)  |
| `pnpm test`      | Vitest unit tests for the pure `src/core` code |
| `pnpm typecheck` | `tsc --noEmit`                                 |
| `pnpm lint`      | ESLint                                         |
| `pnpm format`    | Prettier                                       |

## Architecture

```
src/
├── core/            Pure TypeScript, no DOM/React — runs on main thread and in the export worker
│   ├── parser/      Wide CSV → Dataset + health warnings
│   ├── timeline/    buildKeyframes (retention + ranks), frameAt(t) (lerp value/rank/opacity)
│   ├── render/      Canvas2D renderer in a fixed 1920×1080 logical space
│   └── export/      Codec probing, PNG, deterministic frame-stepped video via mediabunny
├── workers/         export.worker.ts — OffscreenCanvas + WebCodecs off the main thread
├── components/      Workspace (dropzone, table editor, settings), player, export dialog
├── stores/          zustand: project (persisted to IndexedDB), playback, decoded images
└── lib/             IndexedDB adapters, project .json save/load, download helpers
```

`frameAt(t)` is the single source of truth for what's on screen: the preview calls it from `requestAnimationFrame`, the exporter calls it with `t = frame / fps / secondsPerPeriod`. Same `t` → same pixels.

## Browser support

- Preview, editing and PNG export: any modern browser.
- MP4 (H.264) export: Chrome / Edge. Browsers with WebCodecs but no H.264 encoder get a WebM (VP9) file; browsers without WebCodecs see a notice.

## Keyboard

`Space` play/pause · `←` `→` step one period · `Home` / `End` jump to start/end.
