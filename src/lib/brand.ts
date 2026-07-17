/** Legal / display name — use for titles, meta, UI copy, and emails. */
export const COMPANY_NAME = "VedMint Consultancy Services";

/** Short product label when referring to the CRM app itself. */
export const PRODUCT_NAME = "VedMint CRM";

/** Canonical production URL — shown on auth pages so users can verify legitimacy. */
export const OFFICIAL_APP_URL = "https://wa.vedmint.com";

/** Public wordmark served from `public/logo.png`. */
export const LOGO_PATH = "/logo.png";
export const LOGO_WIDTH = 820;
export const LOGO_HEIGHT = 304;

/** Absolute logo URL for emails and Open Graph metadata. */
export function logoUrl(origin: string = OFFICIAL_APP_URL): string {
  return `${origin.replace(/\/+$/, "")}${LOGO_PATH}`;
}

export const SUPPORT_EMAIL = "support@vedmint.com";

export const META_DESCRIPTION =
  "WhatsApp Business CRM by VedMint Consultancy Services — shared inbox, contacts, pipelines, broadcasts, and automations.";

export const COPYRIGHT_NOTICE = `© ${new Date().getFullYear()} ${COMPANY_NAME}. All Rights Reserved.`;

/** VedMint product ecosystem — external properties linked from marketing pages. */
export const VEDMINT_ECOSYSTEM = [
  {
    id: "main",
    name: "VedMint",
    url: "https://www.vedmint.com",
    tagline: "Consultancy & digital solutions",
    description:
      "Our main site — services, company profile, and how we help businesses grow with WhatsApp and CRM.",
  },
  {
    id: "stay",
    name: "Stay by VedMint",
    url: "https://stay.vedmint.com",
    tagline: "Hospitality & stays",
    description:
      "Property and stay management for hotels, homestays, and hospitality partners.",
  },
  {
    id: "discover",
    name: "Discover VedMint",
    url: "https://discover.vedmint.com",
    tagline: "Explore the ecosystem",
    description:
      "Browse VedMint products, guides, and resources across our platform family.",
  },
] as const;
