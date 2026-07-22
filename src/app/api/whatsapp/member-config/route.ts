import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GONE = {
  error:
    "Personal WhatsApp overrides were removed. Add numbers in Settings → WhatsApp and assign them to team members in Team settings.",
};

/** @deprecated Personal member WhatsApp overrides are no longer supported. */
export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

/** @deprecated Personal member WhatsApp overrides are no longer supported. */
export async function POST() {
  return NextResponse.json(GONE, { status: 410 });
}

/** @deprecated Personal member WhatsApp overrides are no longer supported. */
export async function DELETE() {
  return NextResponse.json(GONE, { status: 410 });
}
