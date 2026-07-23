/** Server-only VedMint subscription helpers (Node runtime — mysql/cookies). */

export {
  issueVedmintToken,
  listPlans,
  getCurrentSubscription,
  getSubscriptionStatus,
  getPlanFeatures,
  purchaseSubscription,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  listInvoices,
  downloadInvoicePdf,
  checkFeature,
} from "./client";
export {
  ensureVedmintAccessToken,
  withVedmintToken,
  setVedmintApiTokenCookie,
  clearVedmintApiTokenCookie,
  attachVedmintTokenIfNeeded,
} from "./token";
export {
  PlanGateError,
  planGateResponse,
  toPlanAwareErrorResponse,
  getEntitlementSnapshot,
  assertActiveSubscription,
  assertPlanCapability,
  assertPlanLimit,
  assertCanPerform,
} from "./enforce";
export {
  getVedmintConfig,
  assertVedmintConfigured,
  VEDMINT_API_TOKEN_COOKIE,
} from "./config";
export { VedmintApiError } from "./types";
export type {
  BillingCycle,
  VedmintPlan,
  VedmintSubscription,
  VedmintSubscriptionStatus,
  VedmintPurchaseResult,
  VedmintFeatureCheck,
  VedmintInvoice,
} from "./types";
export type {
  PlanCapability,
  PlanLimitKey,
  EntitlementSnapshot,
} from "./entitlements";
export { toExternalUserId } from "./external-id";
export { applyLocalPlanExpiry } from "./expire-local";
export {
  upsertSubscriptionState,
  listDueExpirations,
  markExpiredApplied,
  ensureSubscriptionStateTable,
  rememberPurchasedBillingCycle,
  getSubscriptionState,
} from "./subscription-state";
export { isSubscriptionActive, getExpiryInfo, pickExpiryDate, resolveSubscriptionPeriodEnd, parseSubscriptionDate } from "./plan-utils";
