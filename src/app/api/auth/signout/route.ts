import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth-verification";

export async function POST() {
  const response = NextResponse.json({ error: null });
  clearSessionCookie(response);
  return response;
}
