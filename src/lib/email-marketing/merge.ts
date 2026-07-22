const MERGE_TAG_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function applyMergeTags(
  input: string,
  vars: Record<string, string>,
): string {
  return input.replace(MERGE_TAG_RE, (_match, key: string) => {
    const value = vars[key];
    return value == null ? "" : value;
  });
}

export function extractMergeTags(input: string): string[] {
  const found = new Set<string>();
  for (const match of input.matchAll(MERGE_TAG_RE)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export function ensureUnsubscribeFooter(
  html: string,
  unsubscribeUrl: string,
): string {
  if (html.includes("{{unsubscribe_url}}") || html.includes(unsubscribeUrl)) {
    return applyMergeTags(html, { unsubscribe_url: unsubscribeUrl });
  }
  const footer = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px"/>
<p style="font-size:12px;color:#6b7280;line-height:1.5;text-align:center">
  You are receiving this because you subscribed to our list.
  <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a>
</p>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }
  return `${html}${footer}`;
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
