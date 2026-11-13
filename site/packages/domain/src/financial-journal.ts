import { AppError } from "./errors";
import type { LedgerEntry } from "./entities";
export type LedgerPosting = Omit<LedgerEntry, "balanceAfter" | "createdAt">;
export function validateLedgerPosting(entries: LedgerPosting[]) {
  const invalid = () =>
    new AppError("A balanced bounded journal is required", 400, "LEDGER_POSTING_INVALID");
  if (entries.length < 2 || entries.length > 100) throw invalid();
  const ids = new Set<string>(),
    totals = new Map<string, bigint>();
  for (const entry of entries) {
    if (
      !/^[A-Za-z0-9_-]{1,128}$/u.test(entry.id) ||
      ids.has(entry.id) ||
      !/^(user|org|platform|escrow):[A-Za-z0-9_-]{1,128}$/u.test(entry.accountId) ||
      !Number.isInteger(entry.amount) ||
      entry.amount === 0 ||
      entry.amount < -2147483648 ||
      entry.amount > 2147483647 ||
      !["USD", "EUR", "RUB"].includes(entry.currency) ||
      !["order", "fee", "payout", "refund"].includes(entry.referenceType) ||
      !/^[A-Za-z0-9_-]{1,128}$/u.test(entry.referenceId) ||
      !entry.description.trim() ||
      entry.description.length > 1000
    )
      throw invalid();
    ids.add(entry.id);
    totals.set(entry.currency, (totals.get(entry.currency) ?? 0n) + BigInt(entry.amount));
  }
  if ([...totals.values()].some((value) => value !== 0n)) throw invalid();
}
