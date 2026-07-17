"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DOC_PAGES } from "@/lib/docs/content";
import {
  docHeading,
  docLinkButton,
  docMuted,
  docNavLink,
  docNavLinkActive,
  docNavPanel,
  docTitle,
} from "@/components/public/public-theme";

export function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description?: string;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <h2 className={docHeading}>{title}</h2>
      {description ? <p className={`mt-1 text-sm ${docMuted}`}>{description}</p> : null}
    </div>
  );
}

export function DocLinkButton({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  if (external) {
    return (
      <Button
        variant="outline"
        size="sm"
        render={
          <a href={href} target="_blank" rel="noopener noreferrer" />
        }
        className={docLinkButton}
      >
        {label}
        <ExternalLink className="size-3.5" />
      </Button>
    );
  }

  if (href.startsWith("#")) {
    return (
      <Button
        variant="outline"
        size="sm"
        render={<a href={href} />}
        className={docLinkButton}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      render={<Link href={href} />}
      className={docLinkButton}
    >
      {label}
      <ArrowRight className="size-3.5" />
    </Button>
  );
}

export function DocsShell({
  title,
  description,
  toc,
  children,
}: {
  title: string;
  description: string;
  toc?: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className={`text-2xl font-bold ${docTitle}`}>{title}</h1>
        <p className={`mt-1 max-w-2xl text-sm ${docMuted}`}>{description}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-6">
          <div className={docNavPanel}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Documentation
            </p>
            <ul className="space-y-1">
              {DOC_PAGES.map((page) => {
                const active = pathname === page.href;
                return (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className={cn(
                        docNavLink,
                        active && docNavLinkActive,
                      )}
                    >
                      {page.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {toc?.length ? (
            <div className={cn("hidden lg:block", docNavPanel)}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                On this page
              </p>
              <ul className="space-y-1.5">
                {toc.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block text-sm text-slate-600 transition-colors hover:text-teal-600"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>

        <div className="min-w-0 space-y-10">{children}</div>
      </div>
    </div>
  );
}

export const TROUBLESHOOTING_ITEMS = [
  {
    issue: "No inbound messages arriving",
    fix: "Verify registered_at is set, webhook URL is correct, messages field subscribed, and App Secret is configured.",
    link: "/settings?tab=whatsapp",
    linkLabel: "Open WhatsApp Config",
  },
  {
    issue: "Webhook returns 401",
    fix: "Add your Meta App Secret in Settings → App Secret.",
    link: "/settings?tab=app-secret",
    linkLabel: "Open App Secret",
  },
  {
    issue: "Templates not sending",
    fix: "Template must be APPROVED in Meta. Sync from Meta in Settings → Templates.",
    link: "/settings?tab=templates",
    linkLabel: "Open Templates",
  },
  {
    issue: "Automation wait steps stuck",
    fix: "Wait steps need background processing every minute — see Background Tasks on Getting Started.",
    link: "/docs/getting-started#cron-jobs",
    linkLabel: "Background Tasks",
  },
  {
    issue: "Team invite link not working",
    fix: "Revoke the old invite and send a new one from Settings → Team.",
    link: "/settings?tab=members",
    linkLabel: "Open Team",
  },
] as const;
