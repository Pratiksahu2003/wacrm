import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { toErrorResponse, toRpcErrorResponse } from "@/lib/auth/account";

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
      return toRpcErrorResponse(error, "Could not leave team");
    }

    return NextResponse.json({ account_id: accountId });
  } catch (err) {
    return toErrorResponse(err);
  }
}
