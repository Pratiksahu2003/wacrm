import type { Metadata } from "next";

import { EmailPlanGate } from "@/components/email/email-plan-gate";

export const metadata: Metadata = {
  title: "Email Marketing",
};

export default function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmailPlanGate>{children}</EmailPlanGate>;
}
