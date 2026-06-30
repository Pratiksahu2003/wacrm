import type { MetadataRoute } from "next";
import { OFFICIAL_APP_URL } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: OFFICIAL_APP_URL,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${OFFICIAL_APP_URL}/docs/getting-started`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${OFFICIAL_APP_URL}/docs/whatsapp-setup`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${OFFICIAL_APP_URL}/docs/troubleshooting`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
