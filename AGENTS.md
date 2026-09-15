<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Data Race — project rules

Read `docs/HANDOFF.md` first: it has the architecture, a full repo map, locked
product decisions, and known gotchas. Don't re-explore the tree to find things.

## Non-negotiables

- `src/core/**` is pure TypeScript: no `react`, `next`, `document`, or `window`
  imports. It runs unchanged inside `src/workers/export.worker.ts`.
- `frameAt(t)` (`src/core/timeline/frameAt.ts`) is the only way to compute
  what's on screen. Preview and export both call it; never fork the logic.
- The renderer draws into a fixed 1920×1080 logical space; callers set the
  canvas transform. Don't make layout depend on the container size.
- Video export is deterministic frame stepping through `mediabunny`. Never use
  `canvas.captureStream()` or `MediaRecorder`.
- Persistence boot goes through `bootProject()` in
  `src/components/workspace/useProjectBoot.ts` only. Don't call
  `useProjectStore.persist.rehydrate()` elsewhere (StrictMode double-run bug).
- zustand selectors must return stable references — no `?? []` / `?? {}` inline.
- Locked scope (wide CSV only, last-value retention, 1080p 30/60 only, single
  project, Chrome/Edge primary) is listed in `docs/HANDOFF.md` §2. Ask before
  changing any of it.

## Conventions

- pnpm. Scripts: `pnpm dev | build | test | typecheck | lint | format`.
- Before claiming done: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.
- Prettier (80 cols, tailwind plugin) is the formatter; run `pnpm format`.
- Unit tests live next to the code as `*.test.ts` under `src/core/` (Vitest,
  node environment). Add tests for any new pure logic.
- shadcn components are generated into `src/components/ui/`; add more with
  `pnpm dlx shadcn@latest add <name>`. Import `cn` from `@/lib/utils`.
- Client components need `"use client"`; anything touching Canvas, workers or
  WebCodecs must be loaded via `next/dynamic(..., { ssr: false })` from a
  client component (see `Workspace.tsx`).
- Next 16 differs from older versions — check `node_modules/next/dist/docs/`
  before using an unfamiliar API.
- Don't commit or push unless asked. No attribution lines in commit messages.
