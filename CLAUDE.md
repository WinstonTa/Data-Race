@AGENTS.md

# Claude-specific notes

- **Start by reading `docs/HANDOFF.md`.** It is the map of this repo.
- In the Bash tool, pnpm is not on PATH. Prefix commands with
  `export PATH="$PATH:$(npm prefix -g)" &&`.
- Dev server: use the in-app browser with `.claude/launch.json` → config `dev`
  (port 3000). The pane throttles `requestAnimationFrame`, so playback looks
  slow there; that's the environment, not a bug. Verify canvas output via
  `javascript_tool` (e.g. paint a decoded video frame into the DOM and
  screenshot) rather than trusting tiny pane screenshots.
- Downloads are inert in the sandbox. To test exports, hook
  `URL.createObjectURL` in page JS to capture the Blob, then decode it with a
  `<video>` / `createImageBitmap` to validate.
- Stop any static server on `out/` before `pnpm build` (Windows EBUSY).
- Persistent memory for this project lives in
  `~/.claude/projects/D--08-Projects-Programming-Data-Race-Data-Race/memory/`.
