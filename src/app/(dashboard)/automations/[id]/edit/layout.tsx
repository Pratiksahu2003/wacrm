import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Automation",
};

export default function EditAutomationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
