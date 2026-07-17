import Link from "next/link";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { Logo } from "@/components/ui/logo";
import { COPYRIGHT_NOTICE } from "@/lib/brand";

export function PublicAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <AuthBrandPanel />

      <div className="flex min-h-screen flex-col bg-white">
        <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-8 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-md">
            <Link
              href="/"
              className="mb-8 block w-[10.5rem] lg:hidden"
            >
              <Logo variant="header" />
            </Link>
            {children}
          </div>
        </div>

        <footer className="border-t border-slate-100 px-4 py-5 text-center text-xs text-slate-400 sm:px-8">
          {COPYRIGHT_NOTICE}
        </footer>
      </div>
    </div>
  );
}
