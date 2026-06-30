"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export function PublicDocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/docs/getting-started"
            className="block min-w-0 w-[11.5rem] shrink-0 sm:w-[13rem]"
          >
            <Logo variant="header" />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/login" />}
              className="border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              Log in
            </Button>
            <Button
              size="sm"
              render={<Link href="/signup" />}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sign up
            </Button>
          </div>
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
