import * as React from "react"
import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "auth" | "sidebar";
  className?: string;
}

export function Logo({ variant = "auth", className }: LogoProps) {
  if (variant === "sidebar") {
    return (
      <img
        src="/logo.png"
        alt="VedMint Crm"
        className={cn(
          "h-8 w-8 object-contain bg-white p-0.5 rounded",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-24 w-[220px] items-center justify-center rounded-2xl bg-white shadow-[0_8px_30px_rgba(255,255,255,0.05)] border border-slate-100 p-3 overflow-hidden transition-all duration-300 hover:scale-[1.02]",
        className
      )}
    >
      <img
        src="/logo.png"
        alt="VedMint Crm"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
