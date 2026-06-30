import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { deleteObjects } from "@/lib/storage";

const JWT_SECRET =
  process.env.ENCRYPTION_KEY ||
  "VedMint Crm-secret-default-encryption-key-32-chars";

export async function POST(request: Request) {
  try {
    const cookiesHeader = request.headers.get("cookie") || "";
    const sessionCookie = cookiesHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("vedmint_crm_session="));

    if (!sessionCookie) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const token = sessionCookie.split("=")[1];
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: { message: "Invalid session" } }, { status: 401 });
    }

    const { bucket, paths } = await request.json();

    if (!bucket || !paths || !Array.isArray(paths)) {
      return NextResponse.json(
        { error: { message: "Missing parameters" } },
        { status: 400 },
      );
    }

    await deleteObjects(bucket, paths);

    return NextResponse.json({ data: null, error: null });
  } catch (err: any) {
    console.error("[POST /api/storage/delete] unexpected error:", err);
    return NextResponse.json(
      { error: { message: err.message || "Delete failed" } },
      { status: 500 },
    );
  }
}
