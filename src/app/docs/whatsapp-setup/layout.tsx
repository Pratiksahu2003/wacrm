import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WhatsApp Setup",
};

export default function WhatsAppSetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
