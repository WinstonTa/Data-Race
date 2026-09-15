import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Workspace } from "@/components/workspace/Workspace";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorBoundary>
        <Workspace />
      </ErrorBoundary>
    </main>
  );
}
