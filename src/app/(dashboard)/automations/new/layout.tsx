import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Automation",
};

export default function NewAutomationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
