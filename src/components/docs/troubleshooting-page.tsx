"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DocsShell,
  DocLinkButton,
  SectionHeading,
  TROUBLESHOOTING_ITEMS,
} from "@/components/docs/docs-shared";

export function TroubleshootingPage() {
  return (
    <DocsShell
      title="Troubleshooting"
      description="Common WhatsApp, email marketing, and CRM issues and where to fix them."
    >
      <div className="flex flex-wrap gap-2">
        <DocLinkButton href="/docs/whatsapp-setup" label="WhatsApp Setup" />
        <DocLinkButton href="/docs/email-marketing" label="Email Marketing" />
        <DocLinkButton href="/docs/getting-started" label="Getting Started" />
      </div>

      <section className="space-y-4">
        <SectionHeading
          id="common-issues"
          title="Common issues"
          description="Quick fixes for the most frequent problems."
        />
        <div className="grid gap-3 md:grid-cols-2">
          {TROUBLESHOOTING_ITEMS.map((item) => (
            <Card
              key={item.issue}
              className="border-slate-200 bg-white shadow-sm ring-slate-200"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">{item.issue}</CardTitle>
                <CardDescription>{item.fix}</CardDescription>
              </CardHeader>
              <CardContent>
                <DocLinkButton href={item.link} label={item.linkLabel} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </DocsShell>
  );
}
