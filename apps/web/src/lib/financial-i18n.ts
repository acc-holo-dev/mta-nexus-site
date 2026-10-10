import { getCommercialCopy } from "./commercial-i18n";
import { getCommerceHistoryCopy } from "./commerce-history-i18n";
const copy = {
  en: {
    title: "Financial statements",
    personal: "Personal account",
    organization: "Organization account",
    organizations: "Organization statements",
    currency: "Currency",
    all: "All currencies",
    balance: "Recorded balance",
    credits: "Recorded credits",
    debits: "Recorded debits",
    held: "Held funds",
    available: "Available to withdraw",
    unknown: "Not reconciled",
    journal: "Balanced journal",
    legacy: "Historical entry",
    empty: "No recorded financial operations.",
    note: "Recorded balances are grouped by currency. They do not prove funds are held, available or withdrawable. The original hold is 7 days; payment confirmation, hold allocation and payouts require a payment provider. This page creates no purchase, payment or access right.",
    review: "Financial reconciliation",
    reviewOnly: "Requires review",
    allOrders: "All recorded orders",
    reviewNote:
      "These signals compare database records. A completed payment status is not external provider verification. This view cannot settle, refund or repair an order.",
    unsupportedCurrency: "Unsupported recorded currency",
    amountMismatch: "Payment amount/currency mismatch",
    missingCapture: "Paid order has no recorded capture",
    multipleCaptures: "Multiple recorded captures",
    cancelledReferences: "Cancelled order has financial references",
    unbalancedLedger: "Ledger references do not balance",
    missingLedger: "Paid order has no ledger references",
    clear: "No structural discrepancy detected",
    details: "Recorded payment attempts",
    ledger: "Referenced ledger totals",
    reference: "Reference",
    date: "Recorded (UTC)",
    back: "Back",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    signIn: "Sign in",
    signInRequired: "Sign in to view financial statements",
  },
  ru: {
    title: "Финансовые выписки",
    personal: "Личный счёт",
    organization: "Счёт организации",
    organizations: "Выписки организаций",
    currency: "Валюта",
    all: "Все валюты",
    balance: "Баланс по записям",
    credits: "Записанные поступления",
    debits: "Записанные списания",
    held: "Удержанные средства",
    available: "Доступно к выводу",
    unknown: "Не сверено",
    journal: "Сбалансированная проводка",
    legacy: "Историческая запись",
    empty: "Финансовых записей нет.",
    note: "Баланс показан отдельно по каждой валюте. Он не подтверждает удержание, доступность или возможность вывода средств. Исходное удержание — 7 дней; подтверждение платежа, распределение удержаний и выплаты требуют платёжного провайдера. Эта страница не создаёт покупки, платежи или права доступа.",
    review: "Сверка финансовых состояний",
    reviewOnly: "Требуют проверки",
    allOrders: "Все записанные заказы",
    reviewNote:
      "Сигналы сопоставляют записи БД. Состояние завершённого платежа не является внешним подтверждением провайдера. Здесь нельзя оплатить, вернуть деньги или исправить заказ.",
    unsupportedCurrency: "Неподдерживаемая валюта записи",
    amountMismatch: "Сумма/валюта платежа не совпадает",
    missingCapture: "У платного заказа нет записи списания",
    multipleCaptures: "Несколько записей успешного списания",
    cancelledReferences: "У отменённого заказа есть финансовые записи",
    unbalancedLedger: "Проводки по ссылкам не сбалансированы",
    missingLedger: "У платного заказа нет проводок",
    clear: "Структурных расхождений не обнаружено",
    details: "Записанные попытки оплаты",
    ledger: "Итоги связанных проводок",
    reference: "Основание",
    date: "Дата записи (UTC)",
    back: "Назад",
    previous: "Назад",
    next: "Далее",
    page: "Страница",
    of: "из",
    signIn: "Войти",
    signInRequired: "Войдите для просмотра финансовых выписок",
  },
} as const;
export const financialFlags = [
  "unsupportedCurrency",
  "amountMismatch",
  "missingCapture",
  "multipleCaptures",
  "cancelledReferences",
  "unbalancedLedger",
  "missingLedger",
] as const;
export function getFinancialCopy(locale: string) {
  return locale === "ru" ? copy.ru : copy.en;
}
export function financialOrderLabel(locale: string, status: string) {
  const labels = getCommerceHistoryCopy(locale === "ru" ? "ru" : "en").orderStatuses;
  return Object.hasOwn(labels, status)
    ? labels[status as keyof typeof labels]
    : getCommercialCopy(locale).unknown;
}
export function financialPaymentLabel(locale: string, status: string) {
  const labels = getCommercialCopy(locale);
  if (status === "cancelled") return labels.cancelledPayment;
  const known = (
    [
      "pending",
      "authorized",
      "completed",
      "failed",
      "refunded",
      "partially_refunded",
      "disputed",
    ] as const
  ).find((value) => value === status);
  return known ? labels[known] : labels.unknown;
}
export function financialReferenceLabel(locale: string, reference: string) {
  const labels =
    locale === "ru"
      ? { order: "Заказ", fee: "Комиссия", payout: "Выплата", refund: "Возврат" }
      : { order: "Order", fee: "Fee", payout: "Payout", refund: "Refund" };
  return Object.hasOwn(labels, reference)
    ? labels[reference as keyof typeof labels]
    : getCommercialCopy(locale).unknown;
}
export function formatFinancialMinor(value: string | number, currency: string, locale: string) {
  if (!["USD", "EUR", "RUB"].includes(currency)) return "—";
  const amount = BigInt(value),
    absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "−" : ""}${(absolute / 100n).toLocaleString(locale)}${locale === "ru" ? "," : "."}${(absolute % 100n).toString().padStart(2, "0")} ${currency}`;
}
