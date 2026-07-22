import type { MetadataRoute } from "next";
import { OFFICIAL_APP_URL } from "@/lib/brand";
import { getSitemapIndexUrl } from "@/lib/seo/sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
          "/discover",
          "/whatsapp-crm",
          "/whatsapp-crm/",
          "/docs",
          "/docs/",
        ],
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
          "/email",
          "/settings",
          "/billing",
          "/compliance",
          "/api/",
        ],
      },
    ],
    host: OFFICIAL_APP_URL.replace(/^https?:\/\//, ""),
    sitemap: getSitemapIndexUrl(),
  };
}
