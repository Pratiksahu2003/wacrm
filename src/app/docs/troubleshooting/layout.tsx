import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Troubleshooting",
};

export default function TroubleshootingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
