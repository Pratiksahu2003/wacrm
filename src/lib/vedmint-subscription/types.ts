/** Shared types for the VedMint Subscription API (v1). */

export type BillingCycle = "monthly" | "yearly";

export interface VedmintApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string | { message?: string; code?: string };
  message?: string;
  code?: string;
}

export interface VedmintAuthTokenData {
  access_token: string;
  token_type: string;
  expires_in: number | null;
  user: {
    uuid: string;
    external_user_id: string | number;
    email: string;
    name?: string;
  };
}

export interface VedmintPlan {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  price?: number;
  monthly_price?: number;
  yearly_price?: number;
  currency?: string;
  billing_cycle?: BillingCycle | string;
  interval?: string;
  features?: string[] | Record<string, unknown>;
  limits?: Record<string, number | string | boolean | null>;
  is_popular?: boolean;
  is_featured?: boolean;
  sort_order?: number;
  [key: string]: unknown;
}

export interface VedmintSubscription {
  id?: number | string;
  status?: string;
  /** Derived when API omits it (e.g. status "Active" + days_remaining). */
  active?: boolean;
  plan?: VedmintPlan | null;
  plan_id?: number;
  plan_name?: string;
  billing_cycle?: BillingCycle | string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  expires_at?: string | null;
  renews_at?: string | null;
  cancelled_at?: string | null;
  days_remaining?: number;
  amount?: number;
  currency?: string;
  features?: string[] | Record<string, unknown>;
  [key: string]: unknown;
}

export interface VedmintSubscriptionStatus {
  active?: boolean;
  status?: string;
  plan_id?: number | null;
  plan_name?: string | null;
  expires_at?: string | null;
  [key: string]: unknown;
}

export interface VedmintInvoice {
  id: number | string;
  invoice_number?: string;
  number?: string;
  status?: string;
  amount?: number;
  total?: number;
  currency?: string;
  issued_at?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  pdf_url?: string | null;
  download_url?: string | null;
  plan_name?: string | null;
  [key: string]: unknown;
}

export interface VedmintPurchaseResult {
  payment_url: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface VedmintFeatureCheck {
  allowed: boolean;
  remaining?: number | null;
  limit?: number | null;
  feature?: string;
  [key: string]: unknown;
}

export class VedmintApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "VedmintApiError";
    this.status = status;
    this.code = code;
  }
}
