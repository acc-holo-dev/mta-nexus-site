import type { Locale } from "../../lib/i18n";

const copy = {
  en: {
    title: "Site wallet",
    back: "Back to financial statements",
    note: "Available balance is the audited ledger total for your personal site wallet. It is not withdrawable. A browser return from a payment provider never credits the wallet — only a verified provider event does.",
    available: "Available balance",
    currency: "Currency",
    topUp: "Top up with stub provider",
    topUpNote:
      "Stub creates a top-up intent only. It does not open a hosted checkout. Balance updates after a verified provider webhook, not after this form.",
    amount: "Amount",
    submit: "Create top-up intent",
    submitting: "Creating top-up intent…",
    success: "Top-up intent recorded",
    intentId: "Intent",
    status: "Status",
    redirectNone: "No hosted redirect from stub.",
    loadUnavailable: "Wallet balance is temporarily unavailable. Ledger records were not loaded.",
    loadUnavailableHint:
      "Retry reloads this wallet page only. A temporary load failure is not an empty wallet.",
    signInRequired: "Sign in to view your site wallet",
    invalid: "Enter a valid amount and currency.",
    rateLimited: "Too many requests. Wait a moment and try again.",
    stateChanged: "Your session changed. Refresh and try again.",
    unavailable: "Wallet top-up is not available.",
    topUpFailed: "Top-up intent was not confirmed. Retry the same request.",
    walletNav: "Site wallet",
    errors: {
      WALLET_ENGINE_DISABLED: "Wallet top-up is not available in this environment.",
      WALLET_TOPUP_INVALID: "Check amount, currency, provider and return path.",
      WALLET_BALANCE_INVALID: "Choose a supported wallet currency.",
      PAYMENT_PROVIDER_UNKNOWN: "Payment provider is not available.",
      TOPUP_IDEMPOTENCY_CONFLICT: "This top-up request was already used with different details.",
      TOPUP_NOT_FOUND: "Top-up intent was not found.",
      STUB_WEBHOOK_UNAUTHORIZED: "Provider webhook signature was rejected.",
      STUB_WEBHOOK_INVALID: "Provider webhook payload is invalid.",
      UNAUTHORIZED: "Sign in again to continue.",
      FORBIDDEN: "Cross-site mutation is forbidden.",
      UNSUPPORTED_MEDIA_TYPE: "Content-Type application/json is required.",
      REQUEST_BODY_TOO_LARGE: "Request body exceeds the allowed size.",
      RATE_LIMIT_EXCEEDED: "Too many requests. Wait a moment and try again.",
      RATE_LIMITED: "Too many requests. Wait a moment and try again.",
      WALLET_SESSION_FAILED: "The wallet operation could not be confirmed. Retry the same request.",
      WALLET_WEBHOOK_FAILED: "Provider webhook could not be processed. Retry the same event.",
      fallback: "The wallet operation could not be confirmed. Retry the same request.",
    },
  },
  ru: {
    title: "Кошелёк площадки",
    back: "К финансовым выпискам",
    note: "Доступный баланс — аудируемый итог ledger по личному site wallet. Это не сумма к выводу. Возврат браузера от платёжного провайдера никогда не зачисляет кошелёк — только подтверждённое событие провайдера.",
    available: "Доступный баланс",
    currency: "Валюта",
    topUp: "Пополнить через stub-провайдер",
    topUpNote:
      "Stub только создаёт намерение пополнения. Hosted checkout не открывается. Баланс обновится после verified webhook провайдера, а не после этой формы.",
    amount: "Сумма",
    submit: "Создать намерение пополнения",
    submitting: "Создание намерения…",
    success: "Намерение пополнения записано",
    intentId: "Намерение",
    status: "Статус",
    redirectNone: "У stub нет hosted redirect.",
    loadUnavailable: "Баланс кошелька временно недоступен. Записи ledger не загружены.",
    loadUnavailableHint:
      "Повтор обновляет только эту страницу кошелька. Временный сбой загрузки — не пустой кошелёк.",
    signInRequired: "Войдите, чтобы увидеть site wallet",
    invalid: "Укажите корректную сумму и валюту.",
    rateLimited: "Слишком много запросов. Подождите немного и повторите.",
    stateChanged: "Сессия изменилась. Обновите страницу и повторите.",
    unavailable: "Пополнение кошелька недоступно.",
    topUpFailed: "Намерение пополнения не подтверждено. Повторите тот же запрос.",
    walletNav: "Кошелёк площадки",
    errors: {
      WALLET_ENGINE_DISABLED: "Пополнение кошелька недоступно в этой среде.",
      WALLET_TOPUP_INVALID: "Проверьте сумму, валюту, провайдера и путь возврата.",
      WALLET_BALANCE_INVALID: "Выберите поддерживаемую валюту кошелька.",
      PAYMENT_PROVIDER_UNKNOWN: "Платёжный провайдер недоступен.",
      TOPUP_IDEMPOTENCY_CONFLICT: "Этот запрос пополнения уже использован с другими данными.",
      TOPUP_NOT_FOUND: "Намерение пополнения не найдено.",
      STUB_WEBHOOK_UNAUTHORIZED: "Подпись webhook провайдера отклонена.",
      STUB_WEBHOOK_INVALID: "Тело webhook провайдера недействительно.",
      UNAUTHORIZED: "Войдите снова, чтобы продолжить.",
      FORBIDDEN: "Межсайтовая мутация запрещена.",
      UNSUPPORTED_MEDIA_TYPE: "Требуется Content-Type application/json.",
      REQUEST_BODY_TOO_LARGE: "Тело запроса превышает допустимый размер.",
      RATE_LIMIT_EXCEEDED: "Слишком много запросов. Подождите немного и повторите.",
      RATE_LIMITED: "Слишком много запросов. Подождите немного и повторите.",
      WALLET_SESSION_FAILED: "Операцию кошелька не удалось подтвердить. Повторите тот же запрос.",
      WALLET_WEBHOOK_FAILED: "Webhook провайдера не обработан. Повторите то же событие.",
      fallback: "Операцию кошелька не удалось подтвердить. Повторите тот же запрос.",
    },
  },
} as const;

export function getWalletCopy(locale: Locale) {
  return locale === "ru" ? copy.ru : copy.en;
}

export function walletError(locale: Locale, code: unknown): string {
  const table = getWalletCopy(locale).errors;
  return typeof code === "string" && Object.hasOwn(table, code)
    ? table[code as keyof typeof table]
    : table.fallback;
}
