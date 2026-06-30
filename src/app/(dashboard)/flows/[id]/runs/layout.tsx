import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flow Runs",
};

export default function FlowRunsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
