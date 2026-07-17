import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import {
  COPYRIGHT_NOTICE,
  OFFICIAL_APP_URL,
  PRODUCT_NAME,
} from "@/lib/brand";

const NAV_LINKS = [
  { href: "/#about", label: "About" },
  { href: "/#features", label: "Features" },
  { href: "/#ecosystem", label: "Ecosystem" },
  { href: "/discover", label: "Discover All" },
  { href: "/docs/getting-started", label: "Docs" },
] as const;

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.06),transparent_50%)]" />

      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="block min-w-0 w-[10.5rem] shrink-0 sm:w-[12rem]"
          >
            <Logo variant="header" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/login" />}
              className="hidden border-slate-700 text-slate-200 hover:bg-slate-800 sm:inline-flex"
            >
              Log in
            </Button>
            <Button
              size="sm"
              render={<Link href="/signup" />}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
            >
              Get started
            </Button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-slate-800/60 px-4 py-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="block w-[11rem]">
                <Logo variant="header" />
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
                {PRODUCT_NAME} — WhatsApp Business CRM by VedMint Consultancy
                Services.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Product
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link
                    href="/discover"
                    className="text-slate-400 hover:text-primary"
                  >
                    Discover all features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/getting-started"
                    className="text-slate-400 hover:text-primary"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-slate-400 hover:text-primary">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signup"
                    className="text-slate-400 hover:text-primary"
                  >
                    Create account
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                VedMint
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a
                    href="https://www.vedmint.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-primary"
                  >
                    www.vedmint.com
                  </a>
                </li>
                <li>
                  <a
                    href="https://stay.vedmint.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-primary"
                  >
                    stay.vedmint.com
                  </a>
                </li>
                <li>
                  <a
                    href="https://discover.vedmint.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-primary"
                  >
                    discover.vedmint.com
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                App
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <span className="font-mono text-slate-500">
                    {OFFICIAL_APP_URL.replace("https://", "")}
                  </span>
                </li>
                <li>
                  <a
                    href="mailto:support@vedmint.com"
                    className="text-slate-400 hover:text-primary"
                  >
                    support@vedmint.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-10 border-t border-slate-800 pt-8 text-center text-xs text-slate-600">
            {COPYRIGHT_NOTICE}
          </p>
        </div>
      </footer>
    </div>
  );
}
