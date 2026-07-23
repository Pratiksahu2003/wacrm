import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email Marketing Docs",
  description:
    "Business & Enterprise: connect SMTP, upload CSV lists, use starter templates, and send campaigns with unsubscribe links.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
