import type { Locale } from "../../lib/i18n";

const en = {
  listingsUnavailable: "Server listings are temporarily unavailable",
  registrationLimitExceeded: "Server registration limit exceeded",
  authenticationRequired: "Authentication required",
  actorRequired: "Actor precondition required",
  actorChanged: "Actor changed",
  forbidden: "Not authorized to create server",
  serverManagerRequired: "Server manager required",
  notFound: "Server not found",
  unsupportedMediaType: "Request must use application/json",
  requestBodyTooLarge: "Request body is too large",
  invalidBodyLength: "Request body length is invalid",
  requestBodyTimeout: "Request body timed out",
  invalidCreationNonce: "Invalid creation nonce",
  invalidServerDetails: "Invalid server details",
  registerFailed: "Could not register server",
  updateLimitExceeded: "Server update limit exceeded",
  updateFailed: "Could not update server",
};

const ru: Record<keyof typeof en, string> = {
  listingsUnavailable: "Список серверов временно недоступен",
  registrationLimitExceeded: "Превышен лимит регистрации серверов",
  authenticationRequired: "Требуется вход",
  actorRequired: "Требуется предусловие актора",
  actorChanged: "Актор изменился",
  forbidden: "Нет прав создавать сервер",
  serverManagerRequired: "Требуется менеджер сервера",
  notFound: "Сервер не найден",
  unsupportedMediaType: "Запрос должен использовать application/json",
  requestBodyTooLarge: "Тело запроса слишком большое",
  invalidBodyLength: "Некорректная длина тела запроса",
  requestBodyTimeout: "Истекло время ожидания тела запроса",
  invalidCreationNonce: "Некорректный nonce создания",
  invalidServerDetails: "Некорректные данные сервера",
  registerFailed: "Не удалось зарегистрировать сервер",
  updateLimitExceeded: "Превышен лимит обновления сервера",
  updateFailed: "Не удалось обновить сервер",
};

export const serversApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
