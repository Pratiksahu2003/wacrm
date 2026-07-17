"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-foreground/80">
        <span className="text-2xl" aria-hidden>
          !
        </span>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Dashboard couldn&apos;t load
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Something went wrong while loading this page. Try reloading, or go back
          and open another section.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload
        </button>
        <Link
          href="/inbox"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Open Inbox
        </Link>
      </div>
    </div>
  );
}
