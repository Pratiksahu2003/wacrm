import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Broadcast",
};

export default function BroadcastDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
