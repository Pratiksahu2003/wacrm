"use client";

import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AuthIconField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  icon: Icon,
  suffix,
  autoComplete,
}: {
  id: string;
  label?: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  icon: LucideIcon;
  suffix?: React.ReactNode;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      {label ? (
        <Label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </Label>
      ) : null}
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          className={cn(
            "h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 text-slate-900 placeholder:text-slate-400",
            "focus-visible:border-teal-500 focus-visible:bg-white focus-visible:ring-teal-500/20",
            suffix ? "pr-11" : undefined,
          )}
        />
        {suffix ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">
            {suffix}
          </div>
        ) : null}
      </div>
    </div>
  );
}
