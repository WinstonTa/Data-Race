"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/useProjectStore";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last line of defence: show the error and offer a reset instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-8">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
          {this.state.error.message}
        </pre>
        <div className="flex gap-2">
          <Button onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              useProjectStore.getState().clear();
              this.setState({ error: null });
            }}
          >
            Reset project
          </Button>
        </div>
      </div>
    );
  }
}
