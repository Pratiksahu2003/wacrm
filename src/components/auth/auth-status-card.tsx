import type { LucideIcon } from "lucide-react";
import { AuthFormCard } from "@/components/auth/auth-form-card";

export function AuthStatusCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <AuthFormCard className="text-center lg:text-left">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-teal-50 ring-1 ring-teal-100 lg:mx-0">
        <Icon className="size-7 text-teal-600" aria-hidden />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </AuthFormCard>
  );
}
