import { expect, it } from "vitest";
import { validateLedgerPosting, type LedgerPosting } from "@nexus/domain";
import { financialStatementQuery, financialReviewQuery } from "../apps/web/src/lib/financial-query";
import { formatFinancialMinor } from "../apps/web/src/lib/financial-i18n";
const lines: LedgerPosting[] = [
  {
    id: "leg_a",
    accountId: "user:usr_a",
    amount: 90,
    currency: "USD",
    referenceType: "fee",
    referenceId: "ref_a",
    description: "Credit",
  },
  {
    id: "leg_b",
    accountId: "platform:nexus",
    amount: -90,
    currency: "USD",
    referenceType: "fee",
    referenceId: "ref_a",
    description: "Debit",
  },
];
it("balances each currency separately, including a mixed-currency batch", () => {
  expect(() => validateLedgerPosting(lines)).not.toThrow();
  expect(() =>
    validateLedgerPosting([
      ...lines,
      ...lines.map((line) => ({ ...line, id: `${line.id}_eur`, currency: "EUR" })),
    ]),
  ).not.toThrow();
  expect(() => validateLedgerPosting([lines[0], { ...lines[1], currency: "EUR" }])).toThrow();
});
it.each([
  { amount: 0 },
  { amount: 1.2 },
  { amount: 2147483648 },
  { currency: "BTC" },
  { accountId: "private" },
  { referenceId: "../secret" },
  { description: " " },
])("rejects unsafe journal data %j", (patch) => {
  expect(() => validateLedgerPosting([{ ...lines[0], ...patch }, lines[1]])).toThrow();
});
it("rejects duplicate entries, incomplete and oversized postings", () => {
  for (const input of [
    [],
    [lines[0]],
    [lines[0], { ...lines[1], id: lines[0].id }],
    Array.from({ length: 101 }, (_, i) => ({ ...lines[0], id: `leg_${i}` })),
  ])
    expect(() => validateLedgerPosting(input)).toThrow();
});
it.each([
  "accountId=user:other",
  "currency=BTC",
  "organizationId=../other",
  "page=1&page=2",
  "page=01",
  "page=1001",
])("rejects scope/query injection %s", (query) => {
  expect(() => financialStatementQuery(new URLSearchParams(query))).toThrow();
});
it("uses bounded canonical financial filters", () => {
  expect(
    financialStatementQuery(new URLSearchParams("currency=EUR&organizationId=org_a&page=2")),
  ).toEqual({ currency: "EUR", organizationId: "org_a", page: 2 });
  expect(financialReviewQuery(new URLSearchParams())).toEqual({ page: 1, filter: "review" });
  expect(() => financialReviewQuery(new URLSearchParams("filter=settle"))).toThrow();
});
it("formats large minor-unit balances without floating-point or currency mixing", () => {
  expect(formatFinancialMinor("9007199254740993123", "EUR", "en")).toBe(
    "90,071,992,547,409,931.23 EUR",
  );
  expect(formatFinancialMinor("1", "BTC", "en")).toBe("—");
  expect(formatFinancialMinor(-1, "USD", "en")).toBe("−0.01 USD");
  expect(formatFinancialMinor("100", "RUB", "ru")).toBe("1,00 RUB");
});
