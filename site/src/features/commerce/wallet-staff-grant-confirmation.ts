const GRANT_ID = /^wgr_[a-f0-9]{24}$/u;
const ACCOUNT_ID = /^(?:user|org):[A-Za-z0-9_-]{1,160}$/u;
const USERNAME = /^[a-zA-Z0-9_-]{3,32}$/u;

export type ConfirmedStaffWalletGrant = {
  grantId: string;
  username: string;
  accountId: string;
  amount: number;
  currency: "USD" | "EUR" | "RUB";
  available: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Accept only the grant the signed-in admin just posted. */
export function confirmedStaffWalletGrant(
  value: unknown,
  actorId: string,
): ConfirmedStaffWalletGrant | null {
  if (!record(value) || value.actorId !== actorId) return null;
  if (typeof value.grantId !== "string" || !GRANT_ID.test(value.grantId)) return null;
  if (typeof value.username !== "string" || !USERNAME.test(value.username)) return null;
  if (typeof value.accountId !== "string" || !ACCOUNT_ID.test(value.accountId)) return null;
  if (!Number.isSafeInteger(value.amount) || (value.amount as number) <= 0) return null;
  if (value.currency !== "USD" && value.currency !== "EUR" && value.currency !== "RUB") return null;
  if (!Number.isSafeInteger(value.available)) return null;
  return {
    grantId: value.grantId,
    username: value.username,
    accountId: value.accountId,
    amount: value.amount as number,
    currency: value.currency,
    available: value.available as number,
  };
}
