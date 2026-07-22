import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  downloadInvoicePdf,
  getVedmintConfig,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const config = getVedmintConfig();
    if (!config.configured) {
      return NextResponse.json(
        {
          error: "VedMint Subscription API is not configured",
          code: "VEDMINT_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Invoice id is required" },
        { status: 400 },
      );
    }

    const ctx = await getCurrentAccount();
    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      downloadInvoicePdf(jwt, id),
    );

    if (result.redirectUrl) {
      const response = NextResponse.json({
        data: { url: result.redirectUrl, filename: result.filename },
      });
      return attachVedmintTokenIfNeeded(response, freshToken);
    }

    const response = new NextResponse(result.bytes, {
      status: 200,
      headers: {
        "Content-Type": result.contentType || "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
