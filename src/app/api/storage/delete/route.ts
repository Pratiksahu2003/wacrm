import { NextResponse } from "next/server";

import { deleteObjects } from "@/lib/storage";
import { sessionUserFromRequest } from "@/lib/session-token";

export async function POST(request: Request) {
  try {
    const sessionUser = await sessionUserFromRequest(request);

    if (!sessionUser) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
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
