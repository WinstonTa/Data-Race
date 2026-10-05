import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CityWorkspace } from "@/components/city/CityWorkspace";

export const metadata: Metadata = {
  title: "City 3D · Data Race",
  description:
    "Experimental: explore a city's buildings and roads as clickable 3D entities.",
};

export default function CityPage() {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorBoundary>
        <CityWorkspace />
      </ErrorBoundary>
    </main>
  );
}
