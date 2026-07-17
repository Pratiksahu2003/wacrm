import { cn } from "@/lib/utils";

export function AuthFormCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_40px_rgba(15,23,42,0.08)] sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}
