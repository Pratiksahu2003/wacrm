import * as React from "react"
import { cn } from "@/lib/utils"
import { COMPANY_NAME } from "@/lib/brand"

interface LogoProps {
  variant?: "auth" | "sidebar" | "header";
  className?: string;
}

/** Shared wordmark — fills container width so no empty white bars on the sides. */
function Wordmark({
  className,
  pad = "px-1.5 py-1",
}: {
  className?: string;
  pad?: string;
}) {
  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-md bg-white leading-none",
        pad,
        className
      )}
    >
      <img
        src="/logo.png"
        alt={COMPANY_NAME}
        width={603}
        height={177}
        className="block h-auto w-full select-none"
        draggable={false}
      />
    </div>
  );
}

export function Logo({ variant = "auth", className }: LogoProps) {
  if (variant === "sidebar") {
    return <Wordmark className={className} pad="px-1.5 py-1" />;
  }

  if (variant === "header") {
    return <Wordmark className={className} pad="px-1.5 py-0.5" />;
  }

  return (
    <Wordmark
      className={cn(
        "mx-auto max-w-[17.5rem] rounded-xl border border-slate-100 px-3 py-2 shadow-[0_8px_30px_rgba(255,255,255,0.05)] transition-transform duration-300 hover:scale-[1.02]",
        className
      )}
      pad="px-2 py-1.5"
    />
  );
}
