import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { vm } from "@/components/marketing/marketing-theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/brand";
import type { SeoPage } from "@/lib/seo/whatsapp-crm-pages";
import { cn } from "@/lib/utils";

export function SeoLandingPageContent({
  page,
  related,
}: {
  page: SeoPage;
  related: SeoPage[];
}) {
  return (
    <MarketingShell theme="light">
      <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <Badge variant="secondary" className={cn("mb-4", vm.badge)}>
          {page.country} · {page.industry}
        </Badge>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {page.headline}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
          {page.intro}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button className={vm.btnPrimary} render={<Link href="/signup" />}>
            Get started
            <ArrowRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            className={vm.btnOutline}
            render={<Link href="/pricing" />}
          >
            View pricing
          </Button>
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-slate-900">
            Why {PRODUCT_NAME} for {page.industry} in {page.country}
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {page.benefits.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-slate-900">
            Common use cases
          </h2>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            {page.useCases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-14 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 sm:px-8">
          <h2 className="text-xl font-semibold text-slate-900">
            What you get with {PRODUCT_NAME}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Shared WhatsApp inbox, CRM contacts, pipelines, Meta template
            broadcasts, no-code automations, conversation flows, team roles, and
            billing entitlements — all in one workspace for your team in{" "}
            {page.country}.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              className={vm.btnPrimary}
              render={<Link href="/docs/getting-started" />}
            >
              Read docs
            </Button>
            <Button
              variant="outline"
              className={vm.btnOutline}
              render={<Link href="/discover" />}
            >
              Discover all features
            </Button>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-slate-900">FAQ</h2>
          <dl className="mt-6 space-y-5">
            {page.faqs.map((faq) => (
              <div key={faq.q}>
                <dt className="font-medium text-slate-900">{faq.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {faq.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {related.length > 0 ? (
          <section className="mt-14 border-t border-slate-200 pt-10">
            <h2 className="text-xl font-semibold text-slate-900">
              Related guides
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/whatsapp-crm/${item.slug}`}
                    className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:border-teal-200 hover:text-teal-700"
                  >
                    WhatsApp CRM for {item.industry} in {item.country}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </MarketingShell>
  );
}
