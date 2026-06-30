import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Broadcast",
};

export default function NewBroadcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
