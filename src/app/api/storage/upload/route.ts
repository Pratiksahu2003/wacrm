import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { uploadObject } from "@/lib/storage";

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

    const formData = await request.formData();
    const bucket = formData.get("bucket") as string;
    const pathStr = formData.get("path") as string;
    const file = formData.get("file") as File;

    if (!bucket || !pathStr || !file) {
      return NextResponse.json(
        { error: { message: "Missing parameters" } },
        { status: 400 },
      );
    }

    const bodyBuffer = Buffer.from(await file.arrayBuffer());
    const stored = await uploadObject(
      bucket,
      pathStr,
      bodyBuffer,
      file.type || "application/octet-stream",
    );

    return NextResponse.json({
      data: { path: stored.path, publicUrl: stored.publicUrl },
      error: null,
    });
  } catch (err: any) {
    console.error("[POST /api/storage/upload] unexpected error:", err);
    return NextResponse.json(
      { error: { message: err.message || "Upload failed" } },
      { status: 500 },
    );
  }
}
