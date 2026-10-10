import type { Locale } from "./i18n";
export class SupportClientFailure extends Error {}
export function supportWorkspaceCopy(locale: Locale) {
  return locale === "ru"
    ? {
        search: "Поиск по теме или номеру",
        apply: "Применить фильтры",
        reset: "Сбросить фильтры",
        noMatches: "По выбранным фильтрам обращений нет.",
        queryInvalid: "Некорректные фильтры обращений.",
        resolveOwn: "Моя проблема решена",
        reopenOwn: "Проблема осталась",
        ownHelp:
          "Отметьте проблему решённой или переоткройте решённое обращение. Закрытое сотрудником обращение может переоткрыть только сотрудник.",
        saved: "Состояние обращения сохранено.",
        replySaved: "Ответ сохранён.",
        created: "Обращение создано.",
        reload: "Загрузить актуальное состояние",
        savedRefresh:
          "Изменение сохранено, но обновить список не удалось. Откройте обращение или повторите загрузку.",
        uncertain:
          "Ответ сервера не подтверждён. Загрузите актуальное состояние. Повторная отправка того же сообщения использует сохранённый ключ запроса.",
        history: "История статусов",
        historyEmpty: "Изменений статуса пока нет.",
        historyUnavailable: "Не удалось загрузить историю статусов.",
        historyExpired: "Страница истории больше недоступна. Откройте последние события.",
        older: "Ранее",
        latest: "Последние события",
        auth: "Для работы с обращениями войдите в аккаунт.",
        forbidden: "Нет прав на это действие.",
        notFound: "Обращение недоступно.",
        invalid: "Проверьте поля запроса.",
        tooLarge: "Сообщение слишком большое.",
        media: "Требуется запрос JSON.",
        rate: "Слишком много запросов. Повторите позднее.",
        unavailable: "Сервис поддержки временно недоступен.",
        conflict: "Обращение изменилось. Загрузите актуальное состояние перед повторной попыткой.",
        closed: "Обращение закрыто. Переоткрыть его может сотрудник поддержки.",
        keyConflict:
          "Ключ запроса уже использован для другого сообщения. Загрузите актуальное состояние.",
      }
    : {
        search: "Search subject or case number",
        apply: "Apply filters",
        reset: "Reset filters",
        noMatches: "No cases match these filters.",
        queryInvalid: "Invalid support case filters.",
        resolveOwn: "My problem is solved",
        reopenOwn: "I still need help",
        ownHelp:
          "Mark your problem as solved or reopen a resolved case. Only staff can reopen a case that staff closed.",
        saved: "Case status saved.",
        replySaved: "Reply saved.",
        created: "Support case created.",
        reload: "Load current state",
        savedRefresh:
          "The change was saved, but the list could not refresh. Open the case or reload the list.",
        uncertain:
          "The server response is unconfirmed. Load the current state. Retrying the same message reuses its saved request key.",
        history: "Status history",
        historyEmpty: "No status changes yet.",
        historyUnavailable: "Could not load status history.",
        historyExpired: "This history page is no longer available. Open the latest events.",
        older: "Older",
        latest: "Latest events",
        auth: "Sign in to work with support cases.",
        forbidden: "You cannot perform this action.",
        notFound: "Support case is unavailable.",
        invalid: "Check the request fields.",
        tooLarge: "The message is too large.",
        media: "A JSON request is required.",
        rate: "Too many requests. Try again later.",
        unavailable: "Support is temporarily unavailable.",
        conflict: "This case changed. Load the current state before trying again.",
        closed: "This case is closed. Support staff can reopen it.",
        keyConflict: "This request key was used for another message. Load the current state.",
      };
}
export function supportWorkspaceError(locale: Locale, code: unknown) {
  const c = supportWorkspaceCopy(locale);
  switch (code) {
    case "UNAUTHORIZED":
    case 401:
      return c.auth;
    case "FORBIDDEN":
    case 403:
      return c.forbidden;
    case "NOT_FOUND":
    case 404:
      return c.notFound;
    case "SUPPORT_ACTIVITY_EXPIRED":
      return c.historyExpired;
    case "VALIDATION_ERROR":
    case "SUPPORT_IDEMPOTENCY_KEY_INVALID":
    case 400:
      return c.invalid;
    case "SUPPORT_BODY_TOO_LARGE":
    case "PAYLOAD_TOO_LARGE":
    case 413:
      return c.tooLarge;
    case "UNSUPPORTED_MEDIA_TYPE":
    case 415:
      return c.media;
    case "RATE_LIMIT_EXCEEDED":
    case 429:
      return c.rate;
    case "SUPPORT_IDEMPOTENCY_CONFLICT":
      return c.keyConflict;
    case "SUPPORT_CASE_CLOSED":
      return c.closed;
    case "SUPPORT_MESSAGE_CONFLICT":
    case "SUPPORT_STATUS_CONFLICT":
    case 409:
      return c.conflict;
    default:
      return c.unavailable;
  }
}
