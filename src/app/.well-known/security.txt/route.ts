import { COMPANY_NAME, OFFICIAL_APP_URL, SUPPORT_EMAIL } from "@/lib/brand";

export async function GET() {
  const body = [
    "Contact: mailto:" + SUPPORT_EMAIL,
    "Preferred-Languages: en",
    "Canonical: " + OFFICIAL_APP_URL + "/.well-known/security.txt",
    "Policy: " + OFFICIAL_APP_URL + "/docs/getting-started",
    "",
    "# " + COMPANY_NAME,
    "# Official WhatsApp Business CRM application.",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
