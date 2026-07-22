"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DocsShell,
  DocLinkButton,
  SectionHeading,
} from "@/components/docs/docs-shared";
import { COMPANY_NAME } from "@/lib/brand";

export function EmailMarketingDocsPage() {
  return (
    <DocsShell
      title="Email Marketing"
      description="Bring your own SMTP, grow email lists, send campaigns, and stay compliant with unsubscribe links."
    >
      <div className="flex flex-wrap gap-2">
        <DocLinkButton href="/email" label="Email overview" />
        <DocLinkButton href="/email/smtp" label="SMTP" />
        <DocLinkButton href="/email/lists" label="Lists" />
        <DocLinkButton href="/email/campaigns/new" label="New campaign" />
        <DocLinkButton href="/settings?tab=smtp" label="Settings → SMTP" />
      </div>

      <section className="space-y-4">
        <SectionHeading
          id="overview"
          title="How it works"
          description={`${COMPANY_NAME} hosts the campaign UI and list tools. Your SMTP provider delivers the mail.`}
        />
        <Card className="border-slate-200 bg-white shadow-sm ring-slate-200">
          <CardContent className="space-y-3 pt-4 text-sm text-slate-700">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Connect SMTP (host, port, username, password, from address).</li>
              <li>Create an email list and import CSV or share the public subscribe form.</li>
              <li>Optional: save an HTML template with merge tags.</li>
              <li>Create a campaign, pick the list, compose, send or schedule.</li>
              <li>Track sent / failed / skipped on the campaign detail page.</li>
            </ol>
            <p>
              Email lists are <strong>separate from CRM contacts</strong>. WhatsApp
              broadcasts still use contacts; email marketing uses subscribers.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading
          id="smtp"
          title="Connect SMTP"
          description="Admin+ only. Passwords are encrypted at rest with ENCRYPTION_KEY."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm ring-slate-200">
            <CardHeader>
              <CardTitle className="text-slate-900">Common providers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p>
                <strong>Brevo:</strong> smtp-relay.brevo.com · port 587 · SMTP key
                as password. Whitelist this server’s IP if required.
              </p>
              <p>
                <strong>Gmail:</strong> smtp.gmail.com · port 587 · use an App
                Password (2FA required).
              </p>
              <p>
                <strong>Amazon SES:</strong> email-smtp.&lt;region&gt;.amazonaws.com
                · IAM SMTP credentials · verify your from domain in SES.
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm ring-slate-200">
            <CardHeader>
              <CardTitle className="text-slate-900">Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <ul className="list-disc space-y-1 pl-5">
                <li>From email must be allowed by your provider.</li>
                <li>Use Verify connection, then Send a test email.</li>
                <li>Platform auth mail still uses server env SMTP — not yours.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          id="lists"
          title="Lists, CSV, and subscribe forms"
        />
        <Card className="border-slate-200 bg-white shadow-sm ring-slate-200">
          <CardContent className="space-y-3 pt-4 text-sm text-slate-700">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                CSV format: <code>email,name</code> (header optional). Invalid or
                duplicate rows are skipped; previously unsubscribed emails are
                not re-added via CSV.
              </li>
              <li>
                Each list has a public URL:{" "}
                <code>/subscribe/&lt;slug&gt;</code> — copy it from the list
                detail page.
              </li>
              <li>
                Manual add from the list page can re-opt-in an unsubscribed
                address (admin action).
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading
          id="templates"
          title="Templates & merge tags"
        />
        <Card className="border-slate-200 bg-white shadow-sm ring-slate-200">
          <CardContent className="space-y-3 pt-4 text-sm text-slate-700">
            <p>Supported tags in subject and HTML:</p>
            <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
              <li>{"{{name}}"}</li>
              <li>{"{{email}}"}</li>
              <li>{"{{unsubscribe_url}}"}</li>
            </ul>
            <p>
              If you omit {"{{unsubscribe_url}}"}, a compliant unsubscribe footer
              is appended automatically.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading
          id="campaigns"
          title="Campaigns & delivery stats"
        />
        <Card className="border-slate-200 bg-white shadow-sm ring-slate-200">
          <CardContent className="space-y-3 pt-4 text-sm text-slate-700">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Email → Campaigns → New campaign.</li>
              <li>Choose a list with subscribed recipients.</li>
              <li>Compose (or pick a template) and review.</li>
              <li>Send now, or set a local schedule time.</li>
            </ol>
            <p>
              Stats reflect SMTP accept/reject (sent, failed, skipped). Open and
              click tracking are not included in V1.
            </p>
            <p>
              Optional cron:{" "}
              <code>GET /api/email/campaigns/cron</code> with{" "}
              <code>x-cron-secret</code> resumes stalled sends and starts due
              schedules.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading
          id="unsubscribe"
          title="Unsubscribe compliance"
        />
        <Card className="border-slate-200 bg-white shadow-sm ring-slate-200">
          <CardContent className="space-y-2 pt-4 text-sm text-slate-700">
            <p>
              Every campaign email includes a one-click unsubscribe link. When
              someone unsubscribes, they are skipped on future campaigns for that
              list.
            </p>
            <p>
              Public page: <code>/unsubscribe?token=…</code>
            </p>
          </CardContent>
        </Card>
      </section>
    </DocsShell>
  );
}
