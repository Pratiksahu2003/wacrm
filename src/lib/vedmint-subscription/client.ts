import {
  assertVedmintConfigured,
  getVedmintConfig,
  type VedmintSubscriptionConfig,
} from "./config";
import {
  VedmintApiError,
  type BillingCycle,
  type VedmintApiEnvelope,
  type VedmintAuthTokenData,
  type VedmintFeatureCheck,
  type VedmintInvoice,
  type VedmintPlan,
  type VedmintPurchaseResult,
  type VedmintSubscription,
  type VedmintSubscriptionStatus,
} from "./types";
import { toExternalUserId } from "./external-id";

type HttpMethod = "GET" | "POST";

interface RequestOptions {
  method?: HttpMethod;
  jwt?: string | null;
  body?: unknown;
  config?: VedmintSubscriptionConfig;
}

function extractErrorMessage(
  payload: VedmintApiEnvelope<unknown> | null,
  fallback: string,
): { message: string; code?: string } {
  if (!payload) return { message: fallback };

  // Laravel / VedMint validation shape:
  // { success:false, message:"Validation failed.", errors:[{ field, message, code }] }
  const errorsUnknown = (payload as { errors?: unknown }).errors;
  if (Array.isArray(errorsUnknown) && errorsUnknown.length > 0) {
    const parts = errorsUnknown
      .map((e) => {
        if (!e || typeof e !== "object") return String(e);
        const row = e as { field?: string; message?: string; code?: string };
        if (row.field && row.message) return `${row.field}: ${row.message}`;
        return row.message || row.code || null;
      })
      .filter(Boolean);
    if (parts.length) {
      const first = errorsUnknown[0] as { code?: string };
      return {
        message: parts.join("; "),
        code: first?.code || payload.code,
      };
    }
  }
  if (
    errorsUnknown &&
    typeof errorsUnknown === "object" &&
    !Array.isArray(errorsUnknown)
  ) {
    const parts: string[] = [];
    for (const [field, val] of Object.entries(
      errorsUnknown as Record<string, unknown>,
    )) {
      if (Array.isArray(val)) parts.push(`${field}: ${val.join(", ")}`);
      else if (typeof val === "string") parts.push(`${field}: ${val}`);
    }
    if (parts.length) {
      return { message: parts.join("; "), code: payload.code };
    }
  }

  const err = payload.error;
  if (typeof err === "string" && err.trim()) {
    return { message: err, code: payload.code };
  }
  if (err && typeof err === "object") {
    return {
      message: err.message || fallback,
      code: err.code || payload.code,
    };
  }
  if (payload.message) return { message: payload.message, code: payload.code };
  return { message: fallback, code: payload.code };
}

async function vedmintFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const config = assertVedmintConfigured(options.config ?? getVedmintConfig());
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-App-Key": config.key,
    "X-App-Secret": config.secret,
    Origin: config.origin,
  };
  if (options.jwt) {
    headers.Authorization = `Bearer ${options.jwt}`;
  }

  const res = await fetch(`${config.url}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  let payload: VedmintApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as VedmintApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!res.ok || payload?.success === false) {
    const { message, code } = extractErrorMessage(
      payload,
      `VedMint API request failed (${res.status})`,
    );
    throw new VedmintApiError(message, res.status, code);
  }

  return (payload?.data ?? (payload as unknown as T)) as T;
}

/** Issue a VedMint Subscription API JWT for the signed-in CRM user. */
export async function issueVedmintToken(input: {
  externalUserId: string;
  email: string;
  name?: string | null;
}): Promise<VedmintAuthTokenData> {
  return vedmintFetch<VedmintAuthTokenData>("/auth/token", {
    method: "POST",
    body: {
      // API requires integer external_user_id (UUID strings → 422).
      external_user_id: toExternalUserId(input.externalUserId),
      email: input.email,
      name: input.name || undefined,
    },
  });
}

/** List catalog plans. JWT optional — app credentials alone work for public pricing. */
export async function listPlans(jwt?: string | null): Promise<VedmintPlan[]> {
  const data = await vedmintFetch<
    VedmintPlan[] | { plans: VedmintPlan[]; data?: VedmintPlan[] }
  >("/plans", { jwt: jwt || undefined });
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.plans)) return data.plans;
    if (Array.isArray(data.data)) return data.data;
  }
  return [];
}

/**
 * VedMint `/subscription/current` returns `{ success, subscription }`
 * (no `data` wrapper). `vedmintFetch` then yields the whole envelope —
 * unwrap + normalize so callers always see a flat subscription record.
 */
function normalizeSubscriptionPayload(
  raw: unknown,
): VedmintSubscription | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const nested =
    obj.subscription && typeof obj.subscription === "object"
      ? (obj.subscription as Record<string, unknown>)
      : obj.data &&
          typeof obj.data === "object" &&
          !Array.isArray(obj.data) &&
          ((obj.data as Record<string, unknown>).status != null ||
            (obj.data as Record<string, unknown>).subscription_id != null ||
            (obj.data as Record<string, unknown>).plan_id != null)
        ? (obj.data as Record<string, unknown>)
        : obj;

  // Bare success envelope with no subscription body.
  if (
    nested === obj &&
    "success" in obj &&
    !obj.status &&
    !obj.plan_id &&
    !obj.subscription_id &&
    !obj.plan
  ) {
    return null;
  }

  return normalizeSubscriptionRecord(nested);
}

function normalizeSubscriptionRecord(
  obj: Record<string, unknown>,
): VedmintSubscription {
  const plan =
    obj.plan && typeof obj.plan === "object"
      ? (obj.plan as VedmintPlan)
      : null;
  const status = obj.status != null ? String(obj.status) : undefined;
  const planId = Number(obj.plan_id ?? plan?.id);
  const expiresAt =
    (typeof obj.current_period_end === "string" && obj.current_period_end) ||
    (typeof obj.period_end === "string" && obj.period_end) ||
    (typeof obj.end_date === "string" && obj.end_date) ||
    (typeof obj.renews_at === "string" && obj.renews_at) ||
    (typeof obj.next_billing_at === "string" && obj.next_billing_at) ||
    (typeof obj.next_payment_date === "string" && obj.next_payment_date) ||
    (typeof obj.valid_until === "string" && obj.valid_until) ||
    (typeof obj.valid_till === "string" && obj.valid_till) ||
    (typeof obj.expires_at === "string" && obj.expires_at) ||
    (typeof obj.ends_at === "string" && obj.ends_at) ||
    null;

  let active: boolean | undefined =
    typeof obj.active === "boolean" ? obj.active : undefined;
  if (active === undefined && status) {
    const s = status.toLowerCase();
    if (
      s === "active" ||
      s === "trialing" ||
      s === "paid" ||
      s === "success" ||
      s === "subscribed"
    ) {
      active = true;
    } else if (
      s === "inactive" ||
      s === "expired" ||
      s === "cancelled" ||
      s === "canceled" ||
      s === "past_due"
    ) {
      active = false;
    }
  }
  if (
    active === undefined &&
    typeof obj.days_remaining === "number" &&
    Number.isFinite(obj.days_remaining)
  ) {
    active = obj.days_remaining > 0;
  }

  const planName =
    (typeof obj.plan_name === "string" && obj.plan_name) ||
    (plan?.name ? String(plan.name) : "") ||
    (typeof obj.name === "string" && !("success" in obj) ? obj.name : "") ||
    undefined;

  return {
    ...obj,
    id: (obj.id ?? obj.subscription_id) as string | number | undefined,
    status,
    active,
    plan,
    plan_id:
      Number.isFinite(planId) && planId > 0 ? planId : undefined,
    plan_name: planName || undefined,
    expires_at: expiresAt,
    current_period_end:
      (typeof obj.current_period_end === "string" && obj.current_period_end) ||
      expiresAt,
    days_remaining:
      typeof obj.days_remaining === "number" ? obj.days_remaining : undefined,
  };
}

function normalizeStatusPayload(raw: unknown): VedmintSubscriptionStatus {
  if (!raw || typeof raw !== "object") {
    return { active: false, status: "inactive" };
  }
  const obj = raw as Record<string, unknown>;
  const src =
    obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : obj;

  const status = src.status != null ? String(src.status) : undefined;
  let active: boolean | undefined =
    typeof src.active === "boolean" ? src.active : undefined;
  if (active === undefined && status) {
    const s = status.toLowerCase();
    active =
      s === "active" ||
      s === "trialing" ||
      s === "paid" ||
      s === "success" ||
      s === "subscribed";
  }
  if (
    active === undefined &&
    typeof src.days_remaining === "number" &&
    Number.isFinite(src.days_remaining)
  ) {
    active = src.days_remaining > 0;
  }

  const planId = Number(src.plan_id);
  return {
    ...src,
    active,
    status,
    plan_id: Number.isFinite(planId) && planId > 0 ? planId : null,
    plan_name:
      typeof src.plan_name === "string" ? src.plan_name : null,
    expires_at:
      typeof src.expires_at === "string" ? src.expires_at : null,
    days_remaining:
      typeof src.days_remaining === "number" ? src.days_remaining : undefined,
  };
}

export async function getCurrentSubscription(
  jwt: string,
): Promise<VedmintSubscription | null> {
  try {
    const raw = await vedmintFetch<unknown>("/subscription/current", {
      jwt,
    });
    return normalizeSubscriptionPayload(raw);
  } catch (err) {
    if (
      err instanceof VedmintApiError &&
      (err.status === 404 || err.code === "SUBSCRIPTION_INACTIVE")
    ) {
      return null;
    }
    throw err;
  }
}

export async function getSubscriptionStatus(
  jwt: string,
): Promise<VedmintSubscriptionStatus> {
  const raw = await vedmintFetch<unknown>("/subscription/status", {
    jwt,
  });
  return normalizeStatusPayload(raw);
}

export async function getPlanFeatures(jwt: string): Promise<unknown> {
  return vedmintFetch("/subscription/features", { jwt });
}

export async function purchaseSubscription(
  jwt: string,
  input: {
    planId: number;
    billingCycle?: BillingCycle;
    couponCode?: string;
    paymentGateway?: string;
    successUrl?: string;
    cancelUrl?: string;
  },
): Promise<VedmintPurchaseResult> {
  return vedmintFetch<VedmintPurchaseResult>("/subscriptions/purchase", {
    method: "POST",
    jwt,
    body: {
      plan_id: input.planId,
      payment_gateway: input.paymentGateway || "nimbbl",
      billing_cycle: input.billingCycle || "monthly",
      ...(input.couponCode ? { coupon_code: input.couponCode } : {}),
      // Send several aliases — VedMint/Nimbbl return URL field names vary.
      ...(input.successUrl
        ? {
            success_url: input.successUrl,
            return_url: input.successUrl,
            redirect_url: input.successUrl,
            callback_url: input.successUrl,
          }
        : {}),
      ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
    },
  });
}

export async function cancelSubscription(jwt: string): Promise<unknown> {
  return vedmintFetch("/subscriptions/cancel", { method: "POST", jwt });
}

function normalizeInvoiceList(raw: unknown): VedmintInvoice[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((row) => row && typeof row === "object")
      .map((row) => normalizeInvoiceRecord(row as Record<string, unknown>));
  }
  if (typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const list =
    (Array.isArray(obj.invoices) && obj.invoices) ||
    (Array.isArray(obj.data) && obj.data) ||
    (obj.data &&
      typeof obj.data === "object" &&
      Array.isArray((obj.data as { invoices?: unknown }).invoices) &&
      (obj.data as { invoices: unknown[] }).invoices) ||
    [];
  return (list as unknown[])
    .filter((row) => row && typeof row === "object")
    .map((row) => normalizeInvoiceRecord(row as Record<string, unknown>));
}

function normalizeInvoiceRecord(obj: Record<string, unknown>): VedmintInvoice {
  const id = (obj.id ?? obj.invoice_id ?? obj.uuid) as string | number;
  return {
    ...obj,
    id,
    invoice_number:
      (typeof obj.invoice_number === "string" && obj.invoice_number) ||
      (typeof obj.number === "string" && obj.number) ||
      (id != null ? `INV-${id}` : undefined),
    number: typeof obj.number === "string" ? obj.number : undefined,
    status: obj.status != null ? String(obj.status) : undefined,
    amount:
      typeof obj.amount === "number"
        ? obj.amount
        : typeof obj.total === "number"
          ? obj.total
          : typeof obj.grand_total === "number"
            ? obj.grand_total
            : undefined,
    total: typeof obj.total === "number" ? obj.total : undefined,
    currency:
      typeof obj.currency === "string" ? obj.currency.toUpperCase() : "INR",
    issued_at:
      (typeof obj.issued_at === "string" && obj.issued_at) ||
      (typeof obj.invoice_date === "string" && obj.invoice_date) ||
      (typeof obj.created_at === "string" && obj.created_at) ||
      null,
    created_at: typeof obj.created_at === "string" ? obj.created_at : null,
    paid_at: typeof obj.paid_at === "string" ? obj.paid_at : null,
    pdf_url:
      (typeof obj.pdf_url === "string" && obj.pdf_url) ||
      (typeof obj.download_url === "string" && obj.download_url) ||
      null,
    download_url:
      (typeof obj.download_url === "string" && obj.download_url) ||
      (typeof obj.pdf_url === "string" && obj.pdf_url) ||
      null,
    plan_name:
      typeof obj.plan_name === "string"
        ? obj.plan_name
        : typeof obj.description === "string"
          ? obj.description
          : null,
  };
}

export async function listInvoices(jwt: string): Promise<VedmintInvoice[]> {
  const raw = await vedmintFetch<unknown>("/invoices", { jwt });
  return normalizeInvoiceList(raw);
}

export async function downloadInvoicePdf(
  jwt: string,
  invoiceId: string | number,
): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
  redirectUrl?: string;
}> {
  const config = assertVedmintConfigured(getVedmintConfig());
  const id = encodeURIComponent(String(invoiceId));
  const res = await fetch(`${config.url}/invoices/${id}/download`, {
    method: "GET",
    headers: {
      Accept: "application/pdf, application/octet-stream, application/json",
      "X-App-Key": config.key,
      "X-App-Secret": config.secret,
      Origin: config.origin,
      Authorization: `Bearer ${jwt}`,
    },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "";
  const disposition = res.headers.get("content-disposition") || "";

  if (!res.ok) {
    let message = `Invoice download failed (${res.status})`;
    let code: string | undefined;
    try {
      const payload = (await res.json()) as VedmintApiEnvelope<unknown>;
      const extracted = extractErrorMessage(payload, message);
      message = extracted.message;
      code = extracted.code;
    } catch {
      // binary error body — keep default
    }
    throw new VedmintApiError(message, res.status, code);
  }

  // Some gateways return JSON with a signed PDF URL instead of bytes.
  if (contentType.includes("application/json")) {
    const payload = (await res.json()) as VedmintApiEnvelope<Record<string, unknown>> &
      Record<string, unknown>;
    const data =
      (payload.data && typeof payload.data === "object"
        ? payload.data
        : payload) as Record<string, unknown>;
    const redirectUrl =
      (typeof data.pdf_url === "string" && data.pdf_url) ||
      (typeof data.download_url === "string" && data.download_url) ||
      (typeof data.url === "string" && data.url) ||
      null;
    if (redirectUrl) {
      return {
        bytes: new ArrayBuffer(0),
        contentType: "application/pdf",
        filename: `invoice-${invoiceId}.pdf`,
        redirectUrl,
      };
    }
    throw new VedmintApiError(
      "Invoice download did not return a PDF",
      502,
      "INVOICE_DOWNLOAD_EMPTY",
    );
  }

  const filenameMatch = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(
    disposition,
  );
  const filename = filenameMatch
    ? decodeURIComponent(filenameMatch[1].replace(/"/g, ""))
    : `invoice-${invoiceId}.pdf`;

  return {
    bytes: await res.arrayBuffer(),
    contentType: contentType.includes("pdf")
      ? "application/pdf"
      : contentType || "application/pdf",
    filename,
  };
}

export async function checkFeature(
  jwt: string,
  feature: string,
): Promise<VedmintFeatureCheck> {
  return vedmintFetch<VedmintFeatureCheck>("/subscription/check-feature", {
    method: "POST",
    jwt,
    body: { feature },
  });
}
