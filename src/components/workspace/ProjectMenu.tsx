"use client";

import { FolderOpen, Save } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { openProjectFile, saveProjectFile } from "@/lib/projectFile";
import { useProjectStore } from "@/stores/useProjectStore";

export function ProjectMenu() {
  const hasDataset = useProjectStore((s) => s.dataset !== null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (ev) => {
          const file = ev.target.files?.[0];
          ev.target.value = "";
          if (!file) return;
          try {
            await openProjectFile(file);
            setError(null);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not open project.",
            );
          }
        }}
      />
      {error ? <span className="text-destructive text-sm">{error}</span> : null}
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <FolderOpen /> Open project
      </Button>
      <Button
        variant="outline"
        disabled={!hasDataset}
        onClick={() => void saveProjectFile()}
      >
        <Save /> Save project
      </Button>
    </div>
  );
}
