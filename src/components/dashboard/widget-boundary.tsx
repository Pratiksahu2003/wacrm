"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  title: string;
}

interface State {
  error: Error | null;
}

/** Isolates a single dashboard widget so one failure does not blank the page. */
export class DashboardWidgetBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm text-rose-200">
          <p className="font-medium">{this.props.title} unavailable</p>
          <p className="mt-1 text-xs text-rose-200/80">
            Other dashboard sections are still working.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
