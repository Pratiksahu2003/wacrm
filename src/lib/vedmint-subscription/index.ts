/** Client-safe VedMint subscription exports (no Node/mysql/cookies). */

export {
  VedmintApiError,
  type BillingCycle,
  type VedmintPlan,
  type VedmintSubscription,
  type VedmintSubscriptionStatus,
  type VedmintPurchaseResult,
  type VedmintFeatureCheck,
  type VedmintInvoice,
} from "./types";
export {
  type PlanCapability,
  type PlanLimitKey,
  type EntitlementSnapshot,
  CAPABILITY_LABEL,
  NAV_CAPABILITY,
  FEATURE_ALIASES,
  isBusinessPlan,
  isGrowthPlan,
  isStarterPlan,
  whatsappNumberLimitForPlan,
  whatsappNumberLimitMessage,
  TEAM_BUSINESS_ONLY_MESSAGE,
} from "./entitlements";
export {
  isSubscriptionActive,
  planFeatureList,
  planPrice,
  formatMoney,
  formatDate,
  getExpiryInfo,
  pickExpiryDate,
  resolveSubscriptionPeriodEnd,
  parseSubscriptionDate,
  addBillingPeriod,
  isPastExpiry,
} from "./plan-utils";
export { EXPIRING_SOON_DAYS } from "./entitlements";
