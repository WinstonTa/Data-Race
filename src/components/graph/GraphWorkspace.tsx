"use client";

import dynamic from "next/dynamic";
import { AppNav } from "@/components/AppNav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useGraphStore } from "@/stores/useGraphStore";
import { EdgeListDropzone } from "./EdgeListDropzone";
import { FriendSearch } from "./FriendSearch";
import { GraphControls } from "./GraphControls";
import { GraphExportButtons } from "./GraphExportButtons";
import { GraphWarnings } from "./GraphWarnings";
import { NodeDetails } from "./NodeDetails";
import { NodeTable } from "./NodeTable";
import { SummaryStats } from "./SummaryStats";
import { TopLists } from "./TopLists";
import { useGraphAnalysis } from "./useGraphAnalysis";
import { useGraphBoot } from "./useGraphBoot";

// WebGL / window access must never run during static prerendering.
const GraphCanvas = dynamic(
  () => import("./GraphCanvas").then((m) => m.GraphCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted h-[70vh] min-h-[420px] w-full animate-pulse rounded-lg" />
    ),
  },
);

export function GraphWorkspace() {
  const ready = useGraphBoot();
  useGraphAnalysis(ready);
  const hasData = useGraphStore((s) => s.data !== null);
  const sourceName = useGraphStore((s) => s.sourceName);
  const selectedId = useGraphStore((s) => s.selectedId);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Data Race</h1>
            <p className="text-muted-foreground text-sm">
              {sourceName
                ? `Exploring ${sourceName}`
                : "Friend network analysis from a Discord export"}
            </p>
          </div>
          <AppNav />
        </div>
        <GraphExportButtons />
      </header>

      <EdgeListDropzone />
      <GraphWarnings />

      {ready && hasData ? (
        <>
          <SummaryStats />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <GraphCanvas />
            <ScrollArea className="h-[70vh] min-h-[420px] rounded-lg border">
              <div className="flex flex-col gap-4 p-4">
                <GraphControls />
                <Separator />
                <FriendSearch />
                {selectedId ? <NodeDetails id={selectedId} /> : <TopLists />}
              </div>
            </ScrollArea>
          </div>
          <NodeTable />
        </>
      ) : null}
    </div>
  );
}
