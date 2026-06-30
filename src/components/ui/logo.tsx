import * as React from "react"
import { cn } from "@/lib/utils"
import { COMPANY_NAME } from "@/lib/brand"

interface LogoProps {
  variant?: "auth" | "sidebar";
  className?: string;
}

export function Logo({ variant = "auth", className }: LogoProps) {
  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "flex h-10 w-full items-center justify-center rounded bg-white px-2 py-1",
          className
        )}
      >
        <img
          src="/logo.png"
          alt={COMPANY_NAME}
          className="h-full w-full max-w-full object-contain object-left"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-24 w-[220px] items-center justify-center rounded-2xl bg-white shadow-[0_8px_30px_rgba(255,255,255,0.05)] border border-slate-100  overflow-hidden transition-all duration-300 hover:scale-[1.02]",
        className
      )}
    >
      <img
        src="/logo.png"
        alt={COMPANY_NAME}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
