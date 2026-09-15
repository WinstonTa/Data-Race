"use client";

import dynamic from "next/dynamic";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectStore } from "@/stores/useProjectStore";
import { CsvDropzone } from "./CsvDropzone";
import { HealthAlerts } from "./HealthAlerts";
import { ProjectMenu } from "./ProjectMenu";
import { SettingsPanel } from "./SettingsPanel";
import { TableEditor } from "./TableEditor";
import { useProjectBoot } from "./useProjectBoot";

// Canvas/worker code must never run during static prerendering.
const ExportDialog = dynamic(
  () => import("@/components/export/ExportDialog").then((m) => m.ExportDialog),
  { ssr: false },
);

const Player = dynamic(
  () => import("@/components/player/Player").then((m) => m.Player),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted aspect-video w-full animate-pulse rounded-lg" />
    ),
  },
);

export function Workspace() {
  const ready = useProjectBoot();
  const hasDataset = useProjectStore((s) => s.dataset !== null);
  const sourceName = useProjectStore((s) => s.sourceName);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Data Race</h1>
          <p className="text-muted-foreground text-sm">
            {sourceName
              ? `Editing ${sourceName}`
              : "Animated bar chart races from a CSV"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectMenu />
          <ExportDialog />
        </div>
      </header>

      <CsvDropzone />
      <HealthAlerts />

      {ready && hasDataset ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <Player />
            <ScrollArea className="max-h-[70vh] rounded-lg border p-4">
              <SettingsPanel />
            </ScrollArea>
          </div>
          <TableEditor />
        </>
      ) : null}
    </div>
  );
}
