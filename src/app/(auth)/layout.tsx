import type { Metadata } from "next";
import type { ReactNode } from "react";
import { COMPANY_NAME, META_DESCRIPTION, OFFICIAL_APP_URL } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: `Sign In — ${COMPANY_NAME}`,
    template: `%s — ${COMPANY_NAME}`,
  },
  description: META_DESCRIPTION,
  metadataBase: new URL(OFFICIAL_APP_URL),
  applicationName: COMPANY_NAME,
  authors: [{ name: COMPANY_NAME, url: OFFICIAL_APP_URL }],
  creator: COMPANY_NAME,
  publisher: COMPANY_NAME,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
