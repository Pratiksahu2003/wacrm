import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Broadcasts",
};

export default function BroadcastsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
