import type { Locale } from "../../lib/i18n";

const en = {
  listingsUnavailable: "Server listings are temporarily unavailable",
  registrationLimitExceeded: "Server registration limit exceeded",
  authenticationRequired: "Authentication required",
  actorRequired: "Actor precondition required",
  actorChanged: "Actor changed",
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
  invalidCreationNonce: "Некорректный nonce создания",
  invalidServerDetails: "Некорректные данные сервера",
  registerFailed: "Не удалось зарегистрировать сервер",
  updateLimitExceeded: "Превышен лимит обновления сервера",
  updateFailed: "Не удалось обновить сервер",
};

export const serversApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
