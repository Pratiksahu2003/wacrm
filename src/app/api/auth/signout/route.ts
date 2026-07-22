import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth-verification";
import { clearVedmintApiTokenCookie } from "@/lib/vedmint-subscription/server";

export async function POST() {
  const response = NextResponse.json({ error: null });
  clearSessionCookie(response);
  clearVedmintApiTokenCookie(response);
  return response;
}
