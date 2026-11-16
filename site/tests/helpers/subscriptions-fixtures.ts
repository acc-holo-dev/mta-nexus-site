import type {
  AccountSubscription,
  CommercialPlanTerms,
  SubscriptionCommand,
  SubscriptionReceipt,
} from "@nexus/domain";
export const date = new Date("2026-10-11T20:00:00.000Z"),
  expiresAt = new Date(date.getTime() + 30 * 86400000),
  cancelledAt = new Date(date.getTime() + 3600000);
export const terms: CommercialPlanTerms = {
  titleRu: "Бесплатный тариф",
  titleEn: "Free plan",
  descriptionRu: "Бесплатный тариф для аккаунта",
  descriptionEn: "Free plan for an account",
  price: 0,
  currency: "USD",
  durationDays: 30,
  commissionBps: 750,
};
export const activation: SubscriptionCommand & { action: "activate" } = {
  action: "activate",
  requestId: "11111111-1111-4111-8111-111111111111",
  planId: "cplan_free",
  expectedRevision: 2,
};
export const subscription: AccountSubscription = {
  id: `sub_${"a".repeat(64)}`,
  subjectType: "user",
  subjectId: "usr_a",
  planId: activation.planId,
  planRevision: 2,
  terms,
  startedAt: date,
  expiresAt,
  cancelledAt: null,
  status: "active",
};
export const receipt: SubscriptionReceipt = {
  id: `srec_${"b".repeat(64)}`,
  action: "activate",
  createdAt: date,
  subscription,
};
export const cancellation: SubscriptionCommand & { action: "cancel" } = {
  action: "cancel",
  requestId: "22222222-2222-4222-8222-222222222222",
  subscriptionId: subscription.id,
};
export const plan = {
  ...terms,
  id: activation.planId,
  slug: "free-plan",
  scope: "user" as const,
  status: "published" as const,
  revision: 2,
  updatedAt: date,
};
export const snapshot = (s: AccountSubscription = subscription) =>
  JSON.parse(JSON.stringify({ version: 1, ...s }));
