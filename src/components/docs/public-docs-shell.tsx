"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { vm } from "@/components/marketing/marketing-theme";
import { COPYRIGHT_NOTICE, PRODUCT_NAME } from "@/lib/brand";

export function PublicDocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-light relative min-h-screen bg-white text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-10%,rgba(20,184,166,0.06),transparent)]" />
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-[4.75rem] max-w-6xl items-center gap-4 px-4 py-2.5 sm:px-6">
          <Link href="/" className="inline-flex shrink-0 items-center">
            <Logo variant="header" />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/discover" />}
              className="hidden text-slate-600 hover:text-slate-900 sm:inline-flex"
            >
              Discover
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/login" />}
              className={vm.btnOutline}
            >
              Log in
            </Button>
            <Button
              size="sm"
              render={<Link href="/signup" />}
              className={vm.btnPrimary}
            >
              Sign up
            </Button>
          </div>
        </div>
      </header>
      <main className="relative px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="relative border-t border-slate-200 bg-slate-50 py-8 text-center text-xs text-slate-500">
        {PRODUCT_NAME} — {COPYRIGHT_NOTICE}
      </footer>
    </div>
  );
}
