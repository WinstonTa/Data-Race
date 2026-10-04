import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GraphWorkspace } from "@/components/graph/GraphWorkspace";

export const metadata: Metadata = {
  title: "Friend graph · Data Race",
  description:
    "Visualize a Discord friend list as a network: groups, bridges and mutual-friend metrics.",
};

export default function GraphPage() {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorBoundary>
        <GraphWorkspace />
      </ErrorBoundary>
    </main>
  );
}
