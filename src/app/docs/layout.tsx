import type { Metadata } from "next";
import { PublicDocsShell } from "@/components/docs/public-docs-shell";
import { COMPANY_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: "Documentation",
    template: `%s — ${COMPANY_NAME}`,
  },
  description: `${COMPANY_NAME} documentation — getting started, WhatsApp setup, and troubleshooting.`,
  robots: { index: true, follow: true },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicDocsShell>{children}</PublicDocsShell>;
}
