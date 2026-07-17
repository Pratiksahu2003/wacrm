import { Inbox, MessageSquare, Users } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import {
  AUTH_BRAND_IMAGE_PATH,
  META_DESCRIPTION,
  PRODUCT_NAME,
} from "@/lib/brand";

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
      {/* Realistic team/office photo — WhatsApp CRM context */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${AUTH_BRAND_IMAGE_PATH})` }}
      />

      {/* Navy + teal overlay — keeps logo and copy readable */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-slate-950/88 via-slate-900/82 to-teal-950/88"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(20,184,166,0.18),transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_80%,rgba(15,23,42,0.55),transparent_48%)]"
      />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-12 xl:px-14">
        <div className="mb-10">
          <Logo variant="brand" />
        </div>

        <h1 className="max-w-sm text-3xl font-bold tracking-tight text-white drop-shadow-sm xl:text-4xl">
          {PRODUCT_NAME}
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-slate-200/95 drop-shadow-sm">
          {META_DESCRIPTION}
        </p>

        <ul className="mt-10 space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 text-sm text-slate-100"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-teal-200 ring-1 ring-white/20 backdrop-blur-sm">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="leading-relaxed drop-shadow-sm">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 border-t border-white/15 bg-slate-950/25 px-10 py-6 text-xs text-slate-300 backdrop-blur-sm xl:px-14">
        Official WhatsApp Business CRM by VedMint
      </div>
    </aside>
  );
}
