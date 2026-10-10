import type { Locale } from "./i18n";
import { serverMutationErrorMessage } from "./server-mutation-errors";

const en = {
  title: "Server verification",
  verified: "Server verified",
  pending: "Awaiting moderation",
  approved: "Request approved",
  rejected: "Request rejected",
  yourRequest: "Your request",
  teamRequest: "Request from another manager",
  created: "Submitted",
  resolved: "Reviewed",
  wait: "A request is already awaiting moderation. A new challenge is available after the moderator closes it. Current management permissions are checked again before approval.",
  outdated:
    "The proof no longer matches this server's address or organization. The moderator must reject a pending request before a new proof can be submitted.",
  retry: "You can submit a new control proof for review.",
  refresh: "Refresh status",
  errors: {
    SERVER_CLAIM_AUTHORITY_CHANGED:
      "Your organization management permissions changed. Refresh the page and check your access.",
    SERVER_CLAIM_SCOPE_CHANGED: "The server's organization changed. Start a new control challenge.",
    INVALID_SERVER_CONTROL_CHALLENGE:
      "The challenge expired or was replaced. Start a new challenge.",
    SERVER_CONTROL_SNAPSHOT_TOO_OLD:
      "The directory has not observed the challenge yet. Wait for its next update and retry.",
    MTA_DIRECTORY_STALE: "The MTA directory is temporarily out of date. Retry later.",
    MTA_DIRECTORY_TIMESTAMP_INVALID:
      "The directory observation time could not be verified. Retry later.",
    SERVER_CONTROL_PROOF_NOT_LIVE:
      "The server must be visible and responding in the official MTA directory.",
    SERVER_CONTROL_TOKEN_NOT_VISIBLE:
      "The token is not visible in the current server name. Keep it in the name and retry after the directory updates.",
    REQUEST_BODY_TIMEOUT: "The request timed out. Retry after refreshing the page.",
    INVALID_BODY_LENGTH: "The request could not be read. Refresh the page and retry.",
    CONFLICT:
      "The server or request changed. Refresh the page to check its status before starting a new challenge.",
    FORBIDDEN: "You do not currently manage this server's organization.",
    UNSUPPORTED_MEDIA_TYPE: "The request could not be read. Refresh the page and retry.",
    REQUEST_BODY_TOO_LARGE: "The request is too large. Refresh the page and retry.",
  },
};
const ru: typeof en = {
  title: "Подтверждение сервера",
  verified: "Сервер подтверждён",
  pending: "Ожидает модерации",
  approved: "Заявка одобрена",
  rejected: "Заявка отклонена",
  yourRequest: "Ваша заявка",
  teamRequest: "Заявка другого управляющего",
  created: "Отправлена",
  resolved: "Рассмотрена",
  wait: "Заявка уже ожидает модерации. Новая проверка станет доступна после её закрытия модератором. Перед одобрением права управления проверяются заново.",
  outdated:
    "Доказательство больше не соответствует адресу или организации сервера. Модератор должен отклонить ожидающую заявку, прежде чем можно будет отправить новое доказательство.",
  retry: "Можно отправить новое доказательство контроля на рассмотрение.",
  refresh: "Обновить статус",
  errors: {
    SERVER_CLAIM_AUTHORITY_CHANGED:
      "Права управления организацией изменились. Обновите страницу и проверьте доступ.",
    SERVER_CLAIM_SCOPE_CHANGED: "Организация сервера изменилась. Начните новую проверку контроля.",
    INVALID_SERVER_CONTROL_CHALLENGE: "Проверка истекла или была заменена. Начните новую проверку.",
    SERVER_CONTROL_SNAPSHOT_TOO_OLD:
      "Каталог ещё не увидел проверку. Дождитесь следующего обновления и повторите попытку.",
    MTA_DIRECTORY_STALE: "Данные каталога MTA временно устарели. Повторите попытку позже.",
    MTA_DIRECTORY_TIMESTAMP_INVALID:
      "Не удалось подтвердить время наблюдения каталога. Повторите попытку позже.",
    SERVER_CONTROL_PROOF_NOT_LIVE:
      "Сервер должен быть видимым и отвечать в официальном каталоге MTA.",
    SERVER_CONTROL_TOKEN_NOT_VISIBLE:
      "Токен пока не виден в названии сервера. Оставьте его в названии и повторите проверку после обновления каталога.",
    REQUEST_BODY_TIMEOUT: "Время ожидания запроса истекло. Обновите страницу и повторите попытку.",
    INVALID_BODY_LENGTH: "Не удалось прочитать запрос. Обновите страницу и повторите попытку.",
    CONFLICT:
      "Сервер или заявка изменились. Обновите страницу и проверьте статус перед новой проверкой.",
    FORBIDDEN: "У вас сейчас нет прав управления организацией этого сервера.",
    UNSUPPORTED_MEDIA_TYPE: "Не удалось прочитать запрос. Обновите страницу и повторите попытку.",
    REQUEST_BODY_TOO_LARGE: "Запрос слишком большой. Обновите страницу и повторите попытку.",
  },
};

export function getServerClaimStatusCopy(locale: Locale) {
  return locale === "ru" ? ru : en;
}

/** Claim responses must not put internal English errors or arbitrary server bodies in the UI. */
export function serverClaimErrorMessage(body: unknown, locale: Locale, fallback: string) {
  const code =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).code
      : undefined;
  return serverMutationErrorMessage({ code }, getServerClaimStatusCopy(locale).errors, fallback);
}
