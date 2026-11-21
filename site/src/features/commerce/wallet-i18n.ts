import type { Locale } from "../../lib/i18n";

const errors = {
  en: {
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
  ru: {
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
} as const;

export function walletError(locale: Locale, code: unknown): string {
  const table = errors[locale];
  return typeof code === "string" && Object.hasOwn(table, code)
    ? table[code as keyof typeof table]
    : table.fallback;
}
