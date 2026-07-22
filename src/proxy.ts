import { NextResponse, type NextRequest } from "next/server";

import {
  readSessionTokenFromCookieHeader,
  verifySessionToken,
} from "@/lib/session-token";

export async function proxy(request: NextRequest) {
  let user: { id: string; email: string } | null = null;
  const token = readSessionTokenFromCookieHeader(
    request.headers.get("cookie"),
  );
  if (token) {
    user = await verifySessionToken(token);
  }

  // Signed-in users visiting the public home page go straight to the app.
  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Supabase may redirect to Site URL root with ?code= when emailRedirectTo
  // wasn't allow-listed — forward to the auth callback handler.
  if (
    request.nextUrl.pathname === "/" &&
    request.nextUrl.searchParams.has("code")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (!url.searchParams.has("next")) {
      url.searchParams.set("next", "/login");
    }
    return NextResponse.redirect(url);
  }

  // Auth pages - redirect to dashboard if already logged in.
  // Exception: when an invite token is in the query string we
  // send the already-signed-in user to /join/<token> instead so
  // they can accept the invitation in one click. Without this,
  // a forwarded invite link to someone who's already signed in
  // would silently drop them on /dashboard.
  if (user && request.nextUrl.pathname === "/verify-email") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup" ||
      request.nextUrl.pathname === "/forgot-password")
  ) {
    const url = request.nextUrl.clone();
    const inviteToken = request.nextUrl.searchParams.get("invite");
    if (
      inviteToken &&
      (request.nextUrl.pathname === "/login" ||
        request.nextUrl.pathname === "/signup")
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`;
      url.search = "";
    } else {
      url.pathname = "/dashboard";
      url.search = "";
    }
    return NextResponse.redirect(url);
  }

  // Protected pages - redirect to login if not authenticated
  const protectedPaths = [
    "/dashboard",
    "/inbox",
    "/contacts",
    "/pipelines",
    "/broadcasts",
    "/automations",
    "/flows",
    "/settings",
    "/billing",
  ];
  if (
    !user &&
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // API routes that need auth (not webhooks)
  if (
    !user &&
    ((request.nextUrl.pathname.startsWith("/api/whatsapp/") &&
      !request.nextUrl.pathname.includes("/webhook")) ||
      request.nextUrl.pathname.startsWith("/api/billing/"))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
