import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Globe,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { FeatureIcon } from "@/components/marketing/feature-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  COMPANY_NAME,
  META_DESCRIPTION,
  PRODUCT_NAME,
  VEDMINT_ECOSYSTEM,
} from "@/lib/brand";
import { DASHBOARD_FEATURES, DOC_PAGES } from "@/lib/docs/content";

const HIGHLIGHT_FEATURES = DASHBOARD_FEATURES.filter((f) =>
  ["inbox", "contacts", "pipelines", "broadcasts", "automations", "flows"].includes(
    f.id,
  ),
);

const ABOUT_POINTS = [
  "Shared WhatsApp inbox for your whole team on one business number",
  "CRM contacts, tags, custom fields, and CSV import",
  "Sales pipelines with drag-and-drop deal management",
  "Template broadcasts with delivery and read tracking",
  "No-code automations and interactive conversation flows",
  "Role-based access for owners, admins, agents, and viewers",
] as const;

export function HomePageContent() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Logo variant="auth" className="mb-8" />

          <Badge
            variant="secondary"
            className="mb-6 border-primary/30 bg-primary/10 text-primary"
          >
            <Sparkles className="mr-1.5 size-3.5" />
            Official {PRODUCT_NAME} app
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            WhatsApp CRM built for{" "}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              growing teams
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            {META_DESCRIPTION}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              render={<Link href="/signup" />}
              className="h-12 w-full bg-gradient-to-r from-violet-600 to-indigo-600 px-8 text-base text-white hover:from-violet-500 hover:to-indigo-500 sm:w-auto"
            >
              Start free
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              render={<Link href="/discover" />}
              className="h-12 w-full border-slate-700 px-8 text-base text-slate-200 hover:bg-slate-800 sm:w-auto"
            >
              Explore everything
            </Button>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-24 border-t border-slate-800/60 bg-slate-900/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                About
              </p>
              <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                {COMPANY_NAME}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-400">
                {PRODUCT_NAME} is the WhatsApp Business CRM from VedMint
                Consultancy Services. Manage conversations, nurture leads, run
                campaigns, and automate follow-ups — all from one dashboard
                connected to the official Meta WhatsApp Business API.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-400">
                Whether you are a sales team, support desk, or marketing agency,
                VedMint gives you a shared inbox, structured pipelines, and
                powerful automations without writing code.
              </p>
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href="https://www.vedmint.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                className="mt-6 border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Visit www.vedmint.com
                <ExternalLink className="size-3.5" />
              </Button>
            </div>

            <Card className="border-slate-800 bg-slate-900/60 ring-slate-800">
              <CardHeader>
                <CardTitle className="text-white">What you get</CardTitle>
                <CardDescription className="text-slate-400">
                  Everything included in {PRODUCT_NAME}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {ABOUT_POINTS.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-sm text-slate-300"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Features
            </p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Everything your team needs
            </h2>
            <p className="mt-4 text-slate-400">
              From first message to closed deal — inbox, CRM, pipelines,
              broadcasts, automations, and flows in one place.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHT_FEATURES.map((feature) => (
              <Card
                key={feature.id}
                className="group border-slate-800 bg-slate-900/40 transition-colors hover:border-primary/30 hover:bg-slate-900/70"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <FeatureIcon id={feature.id} className="size-5" />
                    </div>
                    {feature.badge ? (
                      <Badge variant="secondary" className="text-xs">
                        {feature.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="mt-3 text-lg text-white">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {feature.summary}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-xs text-slate-500">
                    {feature.capabilities.slice(0, 3).map((cap) => (
                      <li key={cap} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                        {cap}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Button
              variant="outline"
              render={<Link href="/discover#dashboard-features" />}
              className="border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              View all {DASHBOARD_FEATURES.length} modules
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Ecosystem */}
      <section
        id="ecosystem"
        className="scroll-mt-24 border-t border-slate-800/60 bg-slate-900/30"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Ecosystem
            </p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Discover VedMint
            </h2>
            <p className="mt-4 text-slate-400">
              {PRODUCT_NAME} is part of the VedMint platform family. Explore
              our other products and resources.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {VEDMINT_ECOSYSTEM.map((site) => (
              <a
                key={site.id}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-primary/40 hover:bg-slate-900/80"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-slate-800 text-primary group-hover:bg-primary/15">
                    <Globe className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{site.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {site.url.replace("https://", "")}
                    </p>
                  </div>
                  <ExternalLink className="ml-auto size-4 shrink-0 text-slate-600 transition-colors group-hover:text-primary" />
                </div>
                <p className="mt-1 text-xs font-medium text-primary/80">
                  {site.tagline}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {site.description}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Docs preview */}
      <section id="docs" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Documentation
              </p>
              <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                Get up and running fast
              </h2>
              <p className="mt-4 text-slate-400">
                Step-by-step guides for Meta WhatsApp setup, dashboard modules,
                team roles, and troubleshooting.
              </p>
              <Button
                size="lg"
                render={<Link href="/docs/getting-started" />}
                className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <BookOpen className="size-4" />
                Read the docs
              </Button>
            </div>

            <div className="space-y-3">
              {DOC_PAGES.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 transition-colors hover:border-primary/30 hover:bg-slate-900/80"
                >
                  <div>
                    <p className="font-medium text-white">{page.label}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {page.description}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-slate-600" />
                </Link>
              ))}
              <Link
                href="/discover#documentation"
                className="flex items-center justify-between rounded-xl border border-dashed border-slate-700 bg-slate-900/30 px-5 py-4 transition-colors hover:border-primary/40 hover:bg-slate-900/50"
              >
                <div>
                  <p className="font-medium text-primary">Full feature hub</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Dashboard modules, settings, roles & more
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-primary" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-violet-950/80 via-slate-900 to-indigo-950/80 px-6 py-12 text-center sm:px-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.12)_0%,transparent_70%)]" />
            <div className="relative">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Ready to transform your WhatsApp workflow?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Create your account, connect Meta WhatsApp, and start managing
                conversations with your team today.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  render={<Link href="/signup" />}
                  className="h-12 w-full bg-white px-8 text-base text-slate-900 hover:bg-slate-100 sm:w-auto"
                >
                  Create free account
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  render={<Link href="/discover" />}
                  className="h-12 w-full border-slate-600 px-8 text-base text-white hover:bg-white/10 sm:w-auto"
                >
                  Browse all features
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
