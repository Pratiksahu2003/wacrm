import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automation Logs",
};

export default function AutomationLogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
