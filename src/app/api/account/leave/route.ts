import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { toErrorResponse } from "@/lib/auth/account";

/** POST — leave the current team and return to an empty personal account. */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: accountId, error } = await supabase.rpc("leave_team");

    if (error) {
      return toErrorResponse(error);
    }

    return NextResponse.json({ account_id: accountId });
  } catch (err) {
    return toErrorResponse(err);
  }
}
