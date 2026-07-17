import { Inbox, MessageSquare, Users } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { META_DESCRIPTION, PRODUCT_NAME } from "@/lib/brand";

const FEATURES = [
  {
    icon: Inbox,
    text: "Shared WhatsApp inbox for your whole team",
  },
  {
    icon: Users,
    text: "Contacts, pipelines & role-based permissions",
  },
  {
    icon: MessageSquare,
    text: "Broadcasts, flows & automations in one place",
  },
] as const;

export function AuthBrandPanel() {
  return (
    <aside className="relative hidden min-h-screen flex-col justify-between overflow-hidden lg:flex">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(20,184,166,0.22),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_85%,rgba(15,23,42,0.6),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-12 xl:px-14">
        <div className="mb-10 w-[13rem] rounded-2xl border border-white/10 bg-white/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <Logo variant="header" />
        </div>

        <h1 className="max-w-sm text-3xl font-bold tracking-tight text-white xl:text-4xl">
          {PRODUCT_NAME}
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-slate-300">
          {META_DESCRIPTION}
        </p>

        <ul className="mt-10 space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-slate-200">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal-300 ring-1 ring-white/10">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 border-t border-white/10 px-10 py-6 text-xs text-slate-400 xl:px-14">
        Official WhatsApp Business CRM by VedMint
      </div>
    </aside>
  );
}
