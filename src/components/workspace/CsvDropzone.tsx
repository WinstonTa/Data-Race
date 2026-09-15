"use client";

import { FileUp } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { parseWideCsv } from "@/core/parser/parseWideCsv";
import {
  loadSampleDataset,
  SAMPLE_FILE_NAME,
  SAMPLE_SETTINGS,
} from "@/data/sampleDataset";
import { cn } from "@/lib/utils";
import { usePlaybackStore } from "@/stores/usePlaybackStore";
import { useProjectStore } from "@/stores/useProjectStore";

const MAX_BYTES = 25 * 1024 * 1024;

/** "gdp_by_country-2024.csv" → "Gdp by country 2024" */
function humanizeFileName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "";
}

export function CsvDropzone() {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 25 MB.");
      return;
    }
    try {
      const text = await file.text();
      const dataset = parseWideCsv(text);
      usePlaybackStore.setState({ t: 0, playing: false });
      useProjectStore.getState().loadDataset(dataset, file.name);
      // The sample's captions don't belong on the user's data.
      useProjectStore.getState().updateSettings({
        title: humanizeFileName(file.name),
        subtitle: "",
        source: "",
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    accept: { "text/csv": [".csv"], "text/plain": [".txt", ".tsv"] },
  });

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps()}
        className={cn(
          "flex items-center justify-between gap-4 rounded-lg border border-dashed p-4 transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-3">
          <FileUp className="text-muted-foreground size-5" />
          <div className="text-sm">
            <div className="font-medium">Drop a CSV here</div>
            <div className="text-muted-foreground">
              Wide format: <code>Name, [Category], 2000, 2001, …</code>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              usePlaybackStore.setState({ t: 0, playing: false });
              useProjectStore
                .getState()
                .loadDataset(loadSampleDataset(), SAMPLE_FILE_NAME);
              useProjectStore.getState().updateSettings(SAMPLE_SETTINGS);
            }}
          >
            Load sample
          </Button>
          <Button onClick={open}>Choose file</Button>
        </div>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
