import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import {
  COMPANY_NAME,
  COPYRIGHT_NOTICE,
  META_DESCRIPTION,
  OFFICIAL_APP_URL,
  PRODUCT_NAME,
} from "@/lib/brand";

export const metadata: Metadata = {
  title: COMPANY_NAME,
  description: META_DESCRIPTION,
  metadataBase: new URL(OFFICIAL_APP_URL),
  alternates: { canonical: OFFICIAL_APP_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${PRODUCT_NAME} — ${COMPANY_NAME}`,
    description: META_DESCRIPTION,
    url: OFFICIAL_APP_URL,
    siteName: COMPANY_NAME,
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" />

      <main className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <Logo variant="auth" className="mb-8" />

        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {COMPANY_NAME}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400 sm:text-lg">
          {META_DESCRIPTION}
        </p>

        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/login">
            <Button
              className="h-11 w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/10 border-0"
            >
              Sign in to {PRODUCT_NAME}
            </Button>
          </Link>
          <Link href="/docs/getting-started">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Documentation
            </Button>
          </Link>
        </div>

        <p className="mt-12 text-xs text-slate-600">
          Official application at{" "}
          <span className="font-mono text-slate-500">
            {OFFICIAL_APP_URL.replace("https://", "")}
          </span>
        </p>
      </main>

      <footer className="relative z-10 mt-16 text-center text-xs text-slate-600 select-none">
        {COPYRIGHT_NOTICE}
      </footer>
    </div>
  );
}
