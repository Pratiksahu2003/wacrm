import * as React from "react"
import { cn } from "@/lib/utils"
import { COMPANY_NAME } from "@/lib/brand"

interface LogoProps {
  variant?: "auth" | "sidebar" | "header";
  className?: string;
}

export function Logo({ variant = "auth", className }: LogoProps) {
  // Wide wordmark (920×271) — scale by height so tagline stays readable.
  if (variant === "sidebar" || variant === "header") {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 items-center overflow-hidden rounded-lg bg-white",
          variant === "header" ? "h-11 px-3 py-1.5" : "h-[4.25rem] px-2.5 py-2",
          className
        )}
      >
        <img
          src="/logo.png"
          alt={COMPANY_NAME}
          width={920}
          height={271}
          className={cn(
            "max-w-full object-contain object-left",
            variant === "header" ? "h-8 w-auto" : "h-14 w-auto"
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full max-w-[min(100%,18rem)] items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(255,255,255,0.05)] transition-all duration-300 hover:scale-[1.02]",
        className
      )}
    >
      <img
        src="/logo.png"
        alt={COMPANY_NAME}
        width={920}
        height={271}
        className="h-16 w-auto max-w-full object-contain"
      />
    </div>
  );
}
