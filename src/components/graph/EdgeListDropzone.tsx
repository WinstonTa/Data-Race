"use client";

import { FileUp } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  buildSampleFriendCsv,
  SAMPLE_GRAPH_FILE_NAME,
} from "@/data/sampleFriendGraph";
import { loadEdgeListText } from "@/lib/loadEdgeList";
import { cn } from "@/lib/utils";

const MAX_BYTES = 25 * 1024 * 1024;

export function EdgeListDropzone() {
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((text: string, name: string) => {
    try {
      loadEdgeListText(text, name);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }, []);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      if (file.size > MAX_BYTES) {
        setError("That file is larger than 25 MB.");
        return;
      }
      load(await file.text(), file.name);
    },
    [load],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    accept: { "text/csv": [".csv"], "text/plain": [".txt"] },
  });

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed p-4 transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-3">
          <FileUp className="text-muted-foreground size-5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Drop a Discord friends CSV here</div>
            <div className="text-muted-foreground">
              One row per friend–mutual pair:{" "}
              <code>
                Friend_ID, Friend_Username, Friend_DisplayName, Mutual_ID,
                Mutual_Username, Mutual_DisplayName
              </code>
              . Leave the Mutual columns empty for friends with no mutuals.
              Everything stays in your browser.
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => load(buildSampleFriendCsv(), SAMPLE_GRAPH_FILE_NAME)}
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
