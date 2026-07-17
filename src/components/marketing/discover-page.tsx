import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  Globe,
  LayoutDashboard,
  Rocket,
  Settings2,
  Shield,
  Wrench,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { COMPANY_NAME, PRODUCT_NAME, VEDMINT_ECOSYSTEM } from "@/lib/brand";
import {
  CRON_JOBS,
  DASHBOARD_FEATURES,
  DOC_PAGES,
  IMPLEMENTATION_STEPS,
  ROLE_MATRIX,
  SETTINGS_TABS,
} from "@/lib/docs/content";

export function DiscoverPageContent() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Header */}
        <div className="max-w-3xl">
          <Badge
            variant="secondary"
            className="mb-4 border-primary/30 bg-primary/10 text-primary"
          >
            Complete reference
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Discover {PRODUCT_NAME}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            Everything in one place — dashboard modules, documentation, settings
            tabs, roles, setup steps, and links across the VedMint ecosystem.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              render={<Link href="/signup" />}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
            >
              Get started
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              render={<Link href="/docs/getting-started" />}
              className="border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              <BookOpen className="size-4" />
              Documentation
            </Button>
          </div>
        </div>

        {/* Quick nav */}
        <nav className="mt-10 flex flex-wrap gap-2">
          {[
            { href: "#dashboard-features", label: "Dashboard" },
            { href: "#documentation", label: "Docs" },
            { href: "#settings", label: "Settings" },
            { href: "#setup", label: "Setup" },
            { href: "#roles", label: "Roles" },
            { href: "#ecosystem", label: "Ecosystem" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Separator className="my-10 bg-slate-800" />

        {/* Dashboard features — full detail */}
        <section id="dashboard-features" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <LayoutDashboard className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Dashboard modules
              </h2>
              <p className="text-sm text-slate-400">
                Every feature in {PRODUCT_NAME} with direct links
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {DASHBOARD_FEATURES.map((feature) => (
              <Card
                key={feature.id}
                className="border-slate-800 bg-slate-900/50 ring-slate-800"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <FeatureIcon id={feature.id} className="size-4" />
                      </div>
                      <div>
                        <CardTitle className="text-white">
                          {feature.title}
                        </CardTitle>
                        {feature.badge ? (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {feature.badge}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={feature.href} />}
                      className="shrink-0 border-slate-700 text-slate-200 hover:bg-slate-800"
                    >
                      Open
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                  <CardDescription className="text-slate-400">
                    {feature.summary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Capabilities
                    </p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {feature.capabilities.map((cap) => (
                        <li key={cap} className="flex items-start gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />
                          {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      How to use
                    </p>
                    <ul className="space-y-1 text-sm text-slate-400">
                      {feature.howToUse.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  {feature.roleNote ? (
                    <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
                      {feature.roleNote}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="my-10 bg-slate-800" />

        {/* Documentation */}
        <section id="documentation" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Documentation</h2>
              <p className="text-sm text-slate-400">
                Guides for setup, WhatsApp, and troubleshooting
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {DOC_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-primary/30 hover:bg-slate-900/80"
              >
                <p className="font-semibold text-white">{page.label}</p>
                <p className="mt-1 text-sm text-slate-500">{page.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                  Read guide
                  <ArrowRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <Separator className="my-10 bg-slate-800" />

        {/* Settings tabs */}
        <section id="settings" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Settings2 className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Settings</h2>
              <p className="text-sm text-slate-400">
                Account configuration tabs with direct links
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SETTINGS_TABS.map((tab) => (
              <Link
                key={tab.tab}
                href={tab.href}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:border-primary/30 hover:bg-slate-900/80"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white">{tab.label}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {tab.description}
                  </p>
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {tab.who}
                  </Badge>
                </div>
                <ArrowRight className="size-4 shrink-0 text-slate-600" />
              </Link>
            ))}
          </div>
        </section>

        <Separator className="my-10 bg-slate-800" />

        {/* Setup steps */}
        <section id="setup" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Rocket className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Implementation plan
              </h2>
              <p className="text-sm text-slate-400">
                Follow these steps to connect Meta WhatsApp and go live
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {IMPLEMENTATION_STEPS.map((step, index) => (
              <Card
                key={step.title}
                className="border-slate-800 bg-slate-900/50 ring-slate-800"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base text-white">
                        {step.title}
                      </CardTitle>
                      <CardDescription className="mt-1 text-slate-400">
                        {step.body}
                      </CardDescription>
                      {step.links?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {step.links.map((link) =>
                            link.external ? (
                              <Button
                                key={link.href + link.label}
                                variant="outline"
                                size="sm"
                                render={
                                  <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  />
                                }
                                className="border-slate-700 text-slate-200 hover:bg-slate-800"
                              >
                                {link.label}
                                <ExternalLink className="size-3.5" />
                              </Button>
                            ) : (
                              <Button
                                key={link.href + link.label}
                                variant="outline"
                                size="sm"
                                render={<Link href={link.href} />}
                                className="border-slate-700 text-slate-200 hover:bg-slate-800"
                              >
                                {link.label}
                                <ArrowRight className="size-3.5" />
                              </Button>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div id="cron-jobs" className="scroll-mt-28">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Wrench className="size-5 text-primary" />
              Background tasks
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {CRON_JOBS.map((job) => (
                <Card
                  key={job.endpoint}
                  className="border-slate-800 bg-slate-900/50 ring-slate-800"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white">
                      {job.endpoint}
                    </CardTitle>
                    <Badge variant="secondary" className="w-fit text-xs">
                      {job.schedule}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-400">{job.purpose}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <Separator className="my-10 bg-slate-800" />

        {/* Roles */}
        <section id="roles" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Shield className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Roles & permissions
              </h2>
              <p className="text-sm text-slate-400">
                What each team role can do in {COMPANY_NAME}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ROLE_MATRIX.map((row) => (
              <Card
                key={row.role}
                className="border-slate-800 bg-slate-900/50 ring-slate-800"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-white">{row.role}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-400">{row.capabilities}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="my-10 bg-slate-800" />

        {/* Ecosystem */}
        <section id="ecosystem" className="scroll-mt-28 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Globe className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                VedMint ecosystem
              </h2>
              <p className="text-sm text-slate-400">
                Explore all VedMint products and properties
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {VEDMINT_ECOSYSTEM.map((site) => (
              <a
                key={site.id}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-primary/40 hover:bg-slate-900/80"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{site.name}</p>
                  <ExternalLink className="size-4 text-slate-600 group-hover:text-primary" />
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {site.url.replace("https://", "")}
                </p>
                <p className="mt-1 text-xs font-medium text-primary/80">
                  {site.tagline}
                </p>
                <p className="mt-3 text-sm text-slate-400">{site.description}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl border border-primary/20 bg-gradient-to-br from-violet-950/60 to-indigo-950/60 p-8 text-center">
          <h2 className="text-xl font-bold text-white">
            Start using {PRODUCT_NAME} today
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Create your account and connect WhatsApp in minutes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              render={<Link href="/signup" />}
              className="bg-white text-slate-900 hover:bg-slate-100"
            >
              Create account
            </Button>
            <Button
              variant="outline"
              render={<Link href="/login" />}
              className="border-slate-600 text-white hover:bg-white/10"
            >
              Sign in
            </Button>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
