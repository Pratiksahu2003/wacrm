import type { MetadataRoute } from "next";
import { OFFICIAL_APP_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/docs", "/docs/"],
        disallow: [
          "/login",
          "/signup",
          "/join",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/auth/",
          "/dashboard",
          "/inbox",
          "/contacts",
          "/pipelines",
          "/broadcasts",
          "/automations",
          "/flows",
          "/settings",
          "/api/",
        ],
      },
    ],
    sitemap: `${OFFICIAL_APP_URL}/sitemap.xml`,
  };
}
