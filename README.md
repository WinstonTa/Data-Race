# Data-Race

Interactive bar chart races for data visualization.

# 🏁 Data Race

> A high-performance, client-side animated bar chart race generator that transforms raw time-series CSV data into fluid, 60 FPS interactive visualizations and video exports.

Data Race allows anyone to upload temporal datasets, inspect and sanitize missing readings in an interactive table editor, dynamically customize entity assets (such as flags or brand icons), preview interpolated rankings at 60 FPS, and export publication-ready assets (PNG snapshots and MP4 videos) directly within the browser—with zero server costs or external rendering farms.

## ⚡ Key Features

- **Instant CSV Ingestion & Streaming:** Off-thread parsing powered by a dedicated Web Worker running `PapaParse` ensures the interface never hitches or drops frames during large uploads.
- **Intelligent Entity Lifecycle Management:**
  - **Last-Value Retention:** Missing intermediate time values seamlessly retain their prior known value until explicitly updated or pruned.
  - **Smooth Exit Pruning:** Entities that leave the top tier or cease emitting data fade out gracefully with animated height and opacity transitions rather than abruptly snapping out of view.
  - **Data Health Registry:** Entries containing zero valid metrics across the entire dataset timeline are safely filtered from the animation loop, accompanied by a non-intrusive alert table notifying the user.
- **Custom Entity Assets & Fallbacks:** Upload custom logos, flags, or category badges directly in the tabular editor. The canvas compositor automatically clips assets into clean circular badges at the leading edge of each bar, falling back to clear typography labels if no image is present.
- **Locked 16:9 Presentation Viewport:** Responsive, letterboxed 16:9 layout (`aspect-video`) with manual high-DPI canvas buffer scaling and an in-memory font-measurement cache to prevent text-measurement bottlenecks.
- **Fully Deterministic Client-Side Video Export:** Generates standalone H.264 MP4 videos directly in the browser using the native **WebCodecs API** (`VideoEncoder`) multiplexed through **`mp4-muxer`**, stepping through time discretely ($\Delta t = \frac{1}{60\text{ s}}$) to eliminate dropped frames.

## 🏗 Architecture Overview

The system is decoupled into an off-thread data processing layer, an interactive canvas loop, and a stepped video encoding worker:

```

┌─────────────────────────────────────────────────────────────────────────────┐
│                             WEB CLIENT INTERFACE                            │
├──────────────────────────────────────┬──────────────────────────────────────┤
│         1. Tabular Workspace         │         2. 16:9 Playback Canvas      │
│  - CSV Drag-and-Drop Parser          │  - Dynamic Scaling 2D Context Engine │
│  - Metadata Editor (Colors/Icons)    │  - Interactive Scrubber, Play/Pause  │
│  - Data Health & Exclusion Registry  │  - Aspect-Ratio Lock (Letterboxed)   │
└──────────────────┬───────────────────┴──────────────────┬───────────────────┘
│ Raw CSV Stream                       │ Frame Stepping Signal
▼                                      ▼
┌──────────────────────────────────────┐ ┌────────────────────────────────────┐
│       Ingestion & Math Worker        │ │     Deterministic Video Worker     │
│  - Worker-Threaded PapaParse Parser  │ │  - OffscreenCanvas Render Pipeline │
│  - Last-Value Retention Engine       │ │  - WebCodecs H.264 VideoEncoder    │
│  - Temporal Rank & Domain LERPs      │ │  - mp4-muxer ArrayBuffer Container │
└──────────────────────────────────────┘ └────────────────────────────────────┘

```

## 💻 Tech Stack

| Layer                | Technology                          | Purpose                                                                      |
| :------------------- | :---------------------------------- | :--------------------------------------------------------------------------- |
| **Framework**        | Next.js (React + TypeScript)        | Application shell, state orchestration, and layout                           |
| **Styling & UI**     | Tailwind CSS + Radix UI (shadcn/ui) | Tabular workspace, controls, modals, and responsive layout                   |
| **State Management** | Zustand (`useChartStore`)           | Reactive store for parsed data, metadata, and playback state                 |
| **Data Ingestion**   | PapaParse (Web Worker)              | Off-thread CSV streaming and validation                                      |
| **Interpolation**    | D3-Interpolate & D3-Scale           | Fractional linear interpolation (`lerp`), rankings, and dynamic scale bounds |
| **Rendering Engine** | HTML5 Canvas 2D API                 | Hardware-accelerated drawing with font-metric caching and high-DPI scaling   |
| **Video Encoding**   | WebCodecs API (`VideoEncoder`)      | In-browser, hardware-accelerated H.264 (AVC) encoding                        |
| **Video Packaging**  | `mp4-muxer`                         | Containerization of encoded H.264 frames into a downloadable `.mp4` file     |

## 📁 Repository Structure

```text
src/
├── core/
│   ├── parser/
│   │   ├── csvWorker.ts          # Off-thread PapaParse stream parser & schema validator
│   │   └── dataSanitizer.ts      # Data health checks & zero-data registry auditing
│   ├── interpolation/
│   │   ├── timelineEngine.ts     # Temporal tick generation & continuous lerp math
│   │   └── rankCalculator.ts     # Dynamic rank transitions & vertical offset smoothing
│   └── export/
│       ├── frameEncoder.ts       # Discrete step loop & WebCodecs handling
│       └── mp4MuxerService.ts    # AVC container muxing & Blob packaging
├── components/
│   ├── workspace/
│   │   ├── TableEditor.tsx       # Tabular editor with image asset uploader
│   │   └── HealthAlerts.tsx      # Diagnostic warnings for empty/unpopulated entities
│   ├── player/
│   │   ├── ViewportContainer.tsx # 16:9 Canvas container with letterbox auto-fit
│   │   └── ScrubControls.tsx     # Scrub bar, play/pause, and playback speed modifiers
│   └── export/
│       └── ExportModal.tsx       # PNG snapshot and MP4 export dialogues
├── stores/
│   └── useChartStore.ts          # Global state (timeline, entities, metadata, active tick)
└── types/
    └── chart.ts                  # Pure TypeScript data contracts and schema definitions

```

## 📄 CSV Format Specification

Data Race reads **wide-format** CSVs: one row per entity, one column per period.

```csv
Name,Category,2000,2001,2002
Alpha,Tech,120,128,140
Beta,Finance,95,102,99
```

- **Name:** The label on each bar.
- **Category (optional):** Entities in the same category share a colour.
- **Period columns:** Any header (`2000`, `Q1 2024`, `Week 3` …). Cells may use
  `$1,234`, `45%`, `(300)` or `1.2e6`; blanks and `n/a` are treated as missing,
  and an entity holds its last known value through gaps.

Messy real-world exports work too. The table editor shows the file exactly as
uploaded and guesses the **header row**, **name column** and **period
columns** — for example a World Bank download with a preamble, `Country Code`
/ `Indicator Name` columns and a trailing empty column is mapped
automatically. If the guess is wrong, pick the header row and name column in
the table, tick or untick a column's **Period** box, click any cell to edit it,
filter rows by name to hide aggregates in bulk, and download either the edited
file or a clean **chart-ready CSV** (`Name, [Category], periods…`).

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.x or later
- **Browser**: Chrome, Edge, Safari 16.4+, or Firefox (WebCodecs support required for in-browser MP4 export)

### Installation

```bash
# Clone the repository
git clone [https://github.com/your-username/data-race.git](https://github.com/your-username/data-race.git)
cd data-race

# Install dependencies
npm install

# Start development server
npm run dev

```

Open [http://localhost:3000](http://localhost:3000) to launch the workspace.

---

## 🎥 Export Architecture: How In-Browser MP4 Works

Unlike traditional screen-recording methods that drop frames when the computer stutters, Data Race uses a **headless deterministic stepping loop**:

1. Playback is paused and decoupled from the system clock.
2. The engine steps forward by exact frame increments ($\Delta t = \frac{1}{60\text{ s}}$).
3. The exact interpolated visual state is rendered onto an internal `OffscreenCanvas`.
4. A `VideoFrame` is created and passed directly to the browser's native `VideoEncoder`.
5. Each `VideoFrame` is explicitly closed (`frame.close()`) to avoid GPU memory leaks.
6. The resulting H.264 chunks are streamed to `mp4-muxer`, which produces a clean `.mp4` binary blob ready for download.

---

## 🛡 Performance Best Practices

- **Font Metric Caching:** Text widths are stored in an in-memory hash map to prevent frequent and expensive `ctx.measureText()` layout calculations.
- **Sub-Pixel Smoothing:** Interpolated ranks are modeled as floating-point numbers so bars slide past each other seamlessly during vertical rank swaps.
- **Decoupled Business Logic:** All interpolation math and ranking algorithms are written as pure TypeScript functions, completely independent of the DOM or Canvas APIs. This ensures effortless future migration to desktop wrappers (Tauri/Electron) or serverless Node worker pools.

## 📄 License

No specific license for now. See `LICENSE` for details.
