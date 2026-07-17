import { cn } from "@/lib/utils";

export function AuthFormHeader({
  badge,
  title,
  description,
  className,
}: {
  badge?: string;
  title: string;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 text-center lg:text-left", className)}>
      {badge ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700">
          <span className="size-1.5 rounded-full bg-teal-500" aria-hidden />
          {badge}
        </div>
      ) : null}
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}
