import { NextResponse } from "next/server";

import { unsubscribeByToken } from "@/lib/email-marketing/lists";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      token?: string;
    };
    const token = (body.token || "").trim();
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const result = await unsubscribeByToken(token);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Invalid link" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        ok: true,
        email: result.email,
        list_name: result.listName,
      },
    });
  } catch (err) {
    console.error("[public/email/unsubscribe]", err);
    return NextResponse.json(
      { error: "Could not unsubscribe. Please try again." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const result = await unsubscribeByToken(token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Invalid link" },
      { status: 404 },
    );
  }
  return NextResponse.json({
    data: {
      ok: true,
      email: result.email,
      list_name: result.listName,
    },
  });
}
