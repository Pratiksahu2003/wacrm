import * as React from "react"
import { cn } from "@/lib/utils"
import { COMPANY_NAME, LOGO_HEIGHT, LOGO_PATH, LOGO_WIDTH } from "@/lib/brand"

interface LogoProps {
  variant?: "auth" | "sidebar" | "header" | "marketing";
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
        src={LOGO_PATH}
        alt={COMPANY_NAME}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
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

  if (variant === "marketing") {
    return (
      <Wordmark
        className={cn(
          "mx-auto max-w-[15rem] rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:scale-[1.02] sm:max-w-[18rem]",
          className
        )}
        pad="px-1 py-1"
      />
    );
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
