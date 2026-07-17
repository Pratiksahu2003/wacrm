import * as React from "react";
import { cn } from "@/lib/utils";
import { COMPANY_NAME, LOGO_HEIGHT, LOGO_PATH, LOGO_WIDTH } from "@/lib/brand";

interface LogoProps {
  variant?: "auth" | "sidebar" | "header" | "marketing" | "brand";
  className?: string;
}

function LogoImage({
  className,
}: {
  className?: string;
}) {
  return (
    <img
      src={LOGO_PATH}
      alt={COMPANY_NAME}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={cn(
        "block max-w-full select-none object-contain object-left",
        className,
      )}
      draggable={false}
    />
  );
}

/** Compact nav wordmark — height-led sizing keeps the wide PNG proportional. */
export function Logo({ variant = "auth", className }: LogoProps) {
  if (variant === "header") {
    return (
      <LogoImage
        className={cn(
          "h-10 w-auto sm:h-11 md:h-12",
          "drop-shadow-[0_1px_3px_rgba(15,23,42,0.08)]",
          className,
        )}
      />
    );
  }

  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "inline-flex w-full items-center rounded-md bg-white px-2 py-1.5",
          className,
        )}
      >
        <LogoImage className="h-7 w-auto max-w-full" />
      </div>
    );
  }

  if (variant === "brand") {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-xl border border-white/10 bg-white/95 px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-sm",
          className,
        )}
      >
        <LogoImage className="h-10 w-auto sm:h-12" />
      </div>
    );
  }

  if (variant === "marketing") {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:scale-[1.02]",
          className,
        )}
      >
        <LogoImage className="h-10 w-auto sm:h-11" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm",
        className,
      )}
    >
      <LogoImage className="h-9 w-auto sm:h-10" />
    </div>
  );
}
