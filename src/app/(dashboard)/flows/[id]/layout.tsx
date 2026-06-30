import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flow Editor",
};

export default function FlowEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
