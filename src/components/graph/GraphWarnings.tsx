"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGraphStore } from "@/stores/useGraphStore";

/** Parse notices (merged duplicates, skipped rows…) and analysis failures. */
export function GraphWarnings() {
  const warnings = useGraphStore((s) => s.warnings);
  const analysisError = useGraphStore((s) => s.analysisError);

  return (
    <>
      {analysisError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>{analysisError}</AlertDescription>
        </Alert>
      ) : null}
      {warnings.length ? (
        <Alert>
          <Info />
          <AlertTitle>Cleaned up while reading the file</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((w) => (
                <li key={w.kind}>{w.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
