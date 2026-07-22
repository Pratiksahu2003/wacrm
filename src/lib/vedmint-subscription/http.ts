import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/auth/account";
import { VedmintApiError } from "@/lib/vedmint-subscription/types";

export function toBillingErrorResponse(err: unknown): NextResponse {
  if (err instanceof VedmintApiError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
      },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
    );
  }
  if (err instanceof Error && /not configured/i.test(err.message)) {
    return NextResponse.json(
      {
        error: err.message,
        code: "VEDMINT_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }
  return toErrorResponse(err);
}
