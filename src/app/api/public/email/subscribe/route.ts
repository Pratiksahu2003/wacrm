import { NextResponse } from "next/server";

import {
  addSubscriber,
  getEmailListBySlug,
} from "@/lib/email-marketing/lists";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      slug?: string;
      email?: string;
      name?: string | null;
    };

    const slug = (body.slug || "").trim();
    const email = (body.email || "").trim();
    if (!slug || !email) {
      return NextResponse.json(
        { error: "slug and email are required" },
        { status: 400 },
      );
    }

    const list = await getEmailListBySlug(slug);
    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const result = await addSubscriber({
      accountId: list.account_id,
      listId: list.id,
      email,
      name: body.name,
      source: "form",
      allowReoptIn: false,
    });

    if (result.skipped === "unsubscribed") {
      return NextResponse.json(
        {
          error:
            "This email previously unsubscribed. Contact the list owner to re-subscribe.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      data: {
        ok: true,
        created: result.created,
        message: result.created
          ? "You are subscribed."
          : "You are already subscribed.",
      },
    });
  } catch (err) {
    if (err instanceof Error && /invalid email/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[public/email/subscribe]", err);
    return NextResponse.json(
      { error: "Could not subscribe. Please try again." },
      { status: 500 },
    );
  }
}
