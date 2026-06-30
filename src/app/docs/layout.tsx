import type { Metadata } from "next";
import { PublicDocsShell } from "@/components/docs/public-docs-shell";

export const metadata: Metadata = {
  title: {
    default: "Documentation",
    template: "%s — VedMint CRM Docs",
  },
  description:
    "VedMint CRM documentation — getting started, WhatsApp setup, and troubleshooting.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicDocsShell>{children}</PublicDocsShell>;
}
