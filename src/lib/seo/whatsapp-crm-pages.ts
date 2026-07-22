/**
 * Programmatic SEO landing pages for WhatsApp CRM by country × industry.
 * Worldwide targeting — generates ~1,000 unique public pages under /whatsapp-crm/[slug].
 */

export type SeoPage = {
  slug: string;
  country: string;
  industry: string;
  title: string;
  description: string;
  headline: string;
  intro: string;
  benefits: string[];
  useCases: string[];
  faqs: { q: string; a: string }[];
};

/** Major WhatsApp Business markets worldwide (50 countries × 20 industries ≈ 1,000 pages). */
const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "New Zealand",
  "Ireland",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Belgium",
  "Portugal",
  "Switzerland",
  "Austria",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "India",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Israel",
  "Turkey",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Ghana",
  "Egypt",
  "Morocco",
  "Brazil",
  "Mexico",
  "Argentina",
  "Chile",
  "Colombia",
  "Peru",
  "Singapore",
  "Malaysia",
  "Indonesia",
  "Philippines",
  "Thailand",
  "Vietnam",
  "Japan",
  "South Korea",
  "Hong Kong",
  "Taiwan",
  "Hong Kong",
  "India",
] as const;

const INDUSTRIES = [
  {
    slug: "real-estate",
    name: "Real Estate",
    angle: "property enquiries, site-visit booking, and broker follow-ups",
  },
  {
    slug: "education",
    name: "Education",
    angle: "admissions counselling, fee reminders, and parent updates",
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    angle: "appointment reminders, patient queries, and clinic outreach",
  },
  {
    slug: "ecommerce",
    name: "Ecommerce",
    angle: "order updates, abandoned-cart nudges, and support replies",
  },
  {
    slug: "retail",
    name: "Retail",
    angle: "store promotions, loyalty offers, and customer care",
  },
  {
    slug: "hospitality",
    name: "Hospitality",
    angle: "booking confirmations, guest requests, and review follow-ups",
  },
  {
    slug: "travel",
    name: "Travel Agencies",
    angle: "itinerary sharing, package quotes, and trip reminders",
  },
  {
    slug: "automotive",
    name: "Automotive",
    angle: "test-drive booking, service reminders, and lead qualification",
  },
  {
    slug: "finance",
    name: "Finance & Insurance",
    angle: "lead nurturing, policy renewals, and document collection",
  },
  {
    slug: "saas",
    name: "SaaS & Tech",
    angle: "demo scheduling, onboarding tips, and renewal outreach",
  },
  {
    slug: "logistics",
    name: "Logistics",
    angle: "shipment updates, delivery coordination, and COD confirmations",
  },
  {
    slug: "restaurants",
    name: "Restaurants",
    angle: "table reservations, offers, and feedback collection",
  },
  {
    slug: "beauty-salons",
    name: "Beauty & Salons",
    angle: "appointment booking, package upsells, and rebooking nudges",
  },
  {
    slug: "fitness",
    name: "Fitness & Gyms",
    angle: "membership renewals, class reminders, and trial conversions",
  },
  {
    slug: "legal",
    name: "Legal Services",
    angle: "consultation booking, case updates, and document requests",
  },
  {
    slug: "manufacturing",
    name: "Manufacturing",
    angle: "B2B enquiries, dealer support, and order status updates",
  },
  {
    slug: "agencies",
    name: "Marketing Agencies",
    angle: "client reporting, campaign approvals, and lead handoff",
  },
  {
    slug: "ngos",
    name: "NGOs & Nonprofits",
    angle: "donor updates, volunteer coordination, and campaign outreach",
  },
  {
    slug: "coaching",
    name: "Coaching Institutes",
    angle: "batch enquiries, fee follow-ups, and result announcements",
  },
  {
    slug: "home-services",
    name: "Home Services",
    angle: "quote requests, job scheduling, and technician updates",
  },
] as const;

function countrySlug(country: string): string {
  return country
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildPage(
  country: (typeof COUNTRIES)[number],
  industry: (typeof INDUSTRIES)[number],
): SeoPage {
  const slug = `whatsapp-crm-for-${industry.slug}-in-${countrySlug(country)}`;
  const title = `WhatsApp CRM for ${industry.name} in ${country} | VedMint CRM`;
  const description = `Run WhatsApp Business CRM for ${industry.name.toLowerCase()} teams in ${country}. Shared inbox, contacts, pipelines, broadcasts, and automations on VedMint CRM — available worldwide.`;
  const headline = `WhatsApp CRM for ${industry.name} businesses in ${country}`;
  const intro = `VedMint CRM helps ${industry.name.toLowerCase()} teams in ${country} manage WhatsApp conversations in one shared inbox — with CRM contacts, sales pipelines, template broadcasts, and no-code automations built for ${industry.angle}. Available worldwide on the official WhatsApp Business API.`;

  const benefits = [
    `Centralize every WhatsApp chat for your ${industry.name.toLowerCase()} team in ${country}`,
    `Capture and tag leads from ${industry.angle} without losing context`,
    `Assign conversations to agents and track deals in pipelines`,
    `Send Meta-approved template broadcasts to segmented audiences`,
    `Automate follow-ups so customers in ${country} get timely replies 24/7`,
    `Collaborate with role-based access across owners, admins, and agents`,
  ];

  const useCases = [
    `Qualify inbound WhatsApp enquiries from prospects in ${country}`,
    `Nurture warm leads with template sequences and reminders`,
    `Coordinate sales or support handoffs inside one business number`,
    `Measure delivery and read rates on outreach campaigns`,
  ];

  const faqs = [
    {
      q: `Is VedMint CRM available for ${industry.name} companies in ${country}?`,
      a: `Yes. Teams in ${country} use VedMint CRM worldwide to handle ${industry.angle} on WhatsApp with a shared inbox, CRM records, and automations instead of scattered personal phones.`,
    },
    {
      q: "Do I need the official WhatsApp Business API?",
      a: "VedMint CRM connects through the official Meta WhatsApp Business API. You bring your WABA credentials; we handle inbox, CRM, broadcasts, and flows — in any supported country.",
    },
    {
      q: "How quickly can we start?",
      a: "Create an account, connect WhatsApp credentials in Settings, invite your team, and start answering from the shared inbox the same day.",
    },
  ];

  return {
    slug,
    country,
    industry: industry.name,
    title,
    description,
    headline,
    intro,
    benefits,
    useCases,
    faqs,
  };
}

let cachedPages: SeoPage[] | null = null;

export function getAllSeoPages(): SeoPage[] {
  if (cachedPages) return cachedPages;
  const pages: SeoPage[] = [];
  for (const country of COUNTRIES) {
    for (const industry of INDUSTRIES) {
      pages.push(buildPage(country, industry));
    }
  }
  cachedPages = pages;
  return pages;
}

export function getSeoPageBySlug(slug: string): SeoPage | undefined {
  return getAllSeoPages().find((p) => p.slug === slug);
}

export function getSeoPageCount(): number {
  return getAllSeoPages().length;
}

export function getSeoSlugs(): string[] {
  return getAllSeoPages().map((p) => p.slug);
}

export function getFeaturedSeoPages(limit = 24): SeoPage[] {
  return getAllSeoPages().slice(0, limit);
}

export { COUNTRIES, INDUSTRIES };
