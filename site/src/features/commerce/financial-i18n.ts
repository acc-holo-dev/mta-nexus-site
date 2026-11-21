import type { Locale } from "../../lib/i18n";
import { unknownMarker } from "../../lib/i18n/unknown";
import { getCommerceHistoryCopy } from "./commerce-history-i18n";
import { getCommercialCopy } from "./commercial-i18n";

const copy = {
  en: {
    title: "Financial statements",
    loading: "Loading financial statements…",
    statementsLoadUnavailable:
      "Financial statements are temporarily unavailable. Database records were not loaded.",
    statementsLoadUnavailableHint:
      "Retry reloads this statements page only. A temporary load failure is not an empty finance history.",
    personal: "Personal account",
    organization: "Organization account",
    organizations: "Organization statements",
    currency: "Currency",
    all: "All currencies",
    balance: "Recorded balance",
    credits: "Recorded credits",
    debits: "Recorded debits",
    held: "Seller holds (escrow)",
    available: "Site wallet available",
    availableLegacy: "Available to withdraw",
    unknown: "Not reconciled",
    journal: "Balanced journal",
    legacy: "Historical entry",
    empty: "No recorded financial operations.",
    note: "Recorded balances are grouped by currency. They do not prove funds are held, available or withdrawable. The original hold is 7 days; payment confirmation, hold allocation and payouts require a payment provider. This page creates no purchase, payment or access right.",
    noteWallet:
      "When the site wallet engine is on, held is seller escrow from wallet purchases (ECON-002) and available is the audited ledger balance for this account. Available is not a payout promise until withdrawal policy and a live payout adapter are enabled. Open Site wallet to release matured holds or manage top-ups.",
    review: "Financial reconciliation",
    evidenceDocumentTitle: "Recorded financial evidence",
    reviewLoading: "Loading financial reconciliation…",
    loadUnavailable:
      "Financial reconciliation is temporarily unavailable. Database records were not loaded.",
    loadUnavailableHint:
      "Retry reloads this reconciliation view only. A temporary load failure is not an empty order review list.",
    clearFilters: "Show all recorded orders",
    reviewOnly: "Requires review",
    allOrders: "All recorded orders",
    reviewNote:
      "These signals compare database records. A completed payment status is not external provider verification. This view cannot settle, refund or repair an order.",
    walletReviewNote:
      "These signals compare database records. A completed site-wallet payment is an audited ledger settle, not live PSP verification. This view stays read-only. Staff wallet refund and wallet ops batch tools live on purchase cases and wallet providers when the engine is on.",
    orderCasesLink: "Purchase cases",
    walletProvidersLink: "Wallet providers",
    unsupportedCurrency: "Unsupported recorded currency",
    amountMismatch: "Payment amount/currency mismatch",
    missingCapture: "Paid order has no recorded capture",
    multipleCaptures: "Multiple recorded captures",
    cancelledReferences: "Cancelled order has financial references",
    unbalancedLedger: "Ledger references do not balance",
    missingLedger: "Paid order has no ledger references",
    clear: "No structural discrepancy detected",
    details: "Recorded payment attempts",
    provider: "Provider",
    providerWallet: "Site wallet",
    providerUnknown: "Recorded provider",
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
    loading: "Загрузка финансовых выписок…",
    statementsLoadUnavailable: "Финансовые выписки временно недоступны. Записи БД не загружены.",
    statementsLoadUnavailableHint:
      "Повтор обновляет только эту страницу выписок. Временный сбой загрузки — не пустая финансовая история.",
    personal: "Личный счёт",
    organization: "Счёт организации",
    organizations: "Выписки организаций",
    currency: "Валюта",
    all: "Все валюты",
    balance: "Баланс по записям",
    credits: "Записанные поступления",
    debits: "Записанные списания",
    held: "Холды продавца (escrow)",
    available: "Доступно в site wallet",
    availableLegacy: "Доступно к выводу",
    unknown: "Не сверено",
    journal: "Сбалансированная проводка",
    legacy: "Историческая запись",
    empty: "Финансовых записей нет.",
    note: "Баланс показан отдельно по каждой валюте. Он не подтверждает удержание, доступность или возможность вывода средств. Исходное удержание — 7 дней; подтверждение платежа, распределение удержаний и выплаты требуют платёжного провайдера. Эта страница не создаёт покупки, платежи или права доступа.",
    noteWallet:
      "При включённом site wallet held — escrow продавца после покупок с кошелька (ECON-002), available — аудируемый ledger баланс этого счёта. Available не обещает вывод, пока не включены политика вывода и live payout adapter. Откройте «Кошелёк площадки», чтобы освободить созревшие холды или управлять пополнениями.",
    review: "Сверка финансовых состояний",
    evidenceDocumentTitle: "Зафиксированные финансовые доказательства",
    reviewLoading: "Загрузка сверки финансовых состояний…",
    loadUnavailable: "Сверка финансовых состояний временно недоступна. Записи БД не загружены.",
    loadUnavailableHint:
      "Повтор обновляет только эту сверку. Временный сбой загрузки — не пустой список заказов на проверку.",
    clearFilters: "Показать все записанные заказы",
    reviewOnly: "Требуют проверки",
    allOrders: "Все записанные заказы",
    reviewNote:
      "Сигналы сопоставляют записи БД. Состояние завершённого платежа не является внешним подтверждением провайдера. Здесь нельзя оплатить, вернуть деньги или исправить заказ.",
    walletReviewNote:
      "Сигналы сопоставляют записи БД. Completed платёж site wallet — аудируемый ledger settle, а не live PSP verification. Эта страница остаётся только для чтения. Staff wallet refund и batch-операции wallet живут в обращениях по покупкам и на странице wallet providers, когда engine включён.",
    orderCasesLink: "Обращения по покупкам",
    walletProvidersLink: "Wallet providers",
    unsupportedCurrency: "Неподдерживаемая валюта записи",
    amountMismatch: "Сумма/валюта платежа не совпадает",
    missingCapture: "У платного заказа нет записи списания",
    multipleCaptures: "Несколько записей успешного списания",
    cancelledReferences: "У отменённого заказа есть финансовые записи",
    unbalancedLedger: "Проводки по ссылкам не сбалансированы",
    missingLedger: "У платного заказа нет проводок",
    clear: "Структурных расхождений не обнаружено",
    details: "Записанные попытки оплаты",
    provider: "Провайдер",
    providerWallet: "Site wallet",
    providerUnknown: "Записанный провайдер",
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
export function getFinancialCopy(locale: Locale) {
  return locale === "ru" ? copy.ru : copy.en;
}

export function financialReviewNote(locale: Locale, walletEnabled: boolean) {
  const labels = getFinancialCopy(locale);
  return walletEnabled ? labels.walletReviewNote : labels.reviewNote;
}
export function financialOrderLabel(locale: Locale, status: string) {
  const labels = getCommerceHistoryCopy(locale === "ru" ? "ru" : "en").orderStatuses;
  return Object.hasOwn(labels, status)
    ? labels[status as keyof typeof labels]
    : getCommercialCopy(locale).unknown;
}
export function financialPaymentLabel(locale: Locale, status: string) {
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

export function financialProviderLabel(locale: Locale, provider: string | null | undefined) {
  const labels = getFinancialCopy(locale);
  if (provider === "wallet") return labels.providerWallet;
  if (typeof provider === "string" && provider.trim()) return provider;
  return labels.providerUnknown;
}

export function commercialProviderLabel(
  locale: Locale,
  provider: string | null | undefined,
): string {
  const labels = getCommercialCopy(locale);
  if (provider === "wallet") return labels.providerWallet;
  if (typeof provider === "string" && provider.trim()) return provider;
  return labels.providerUnknown;
}
export function financialReferenceLabel(locale: Locale, reference: string) {
  const labels =
    locale === "ru"
      ? {
          order: "Заказ",
          fee: "Комиссия",
          payout: "Выплата",
          refund: "Возврат",
          topup: "Пополнение",
          wallet_spend: "Оплата с кошелька",
          wallet_hold: "Холд продавца",
          withdrawal: "Вывод",
        }
      : {
          order: "Order",
          fee: "Fee",
          payout: "Payout",
          refund: "Refund",
          topup: "Top-up",
          wallet_spend: "Wallet spend",
          wallet_hold: "Seller hold",
          withdrawal: "Withdrawal",
        };
  return Object.hasOwn(labels, reference)
    ? labels[reference as keyof typeof labels]
    : getCommercialCopy(locale).unknown;
}
export function formatFinancialMinor(value: string | number, currency: string, locale: Locale) {
  if (!["USD", "EUR", "RUB"].includes(currency)) return unknownMarker(locale);
  const amount = BigInt(value),
    absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "−" : ""}${(absolute / 100n).toLocaleString(locale)}${locale === "ru" ? "," : "."}${(absolute % 100n).toString().padStart(2, "0")} ${currency}`;
}
