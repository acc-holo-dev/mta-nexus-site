import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  actorRequired: "Actor precondition required",
  accountChanged: "Account changed",
  rate: "Too many server control proof attempts",
  serverNotFound: "Server not found",
  retry: "Please retry the server claim",
  createFailed: "Could not create server control challenge",
  invalidProof: "Invalid server control proof",
  verifyFailed: "Could not verify server control",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  actorRequired: "Требуется предусловие актора",
  accountChanged: "Аккаунт изменился",
  rate: "Слишком много попыток подтверждения контроля сервера",
  serverNotFound: "Сервер не найден",
  retry: "Повторите подтверждение контроля сервера",
  createFailed: "Не удалось создать задание на подтверждение контроля сервера",
  invalidProof: "Некорректное доказательство контроля сервера",
  verifyFailed: "Не удалось проверить контроль сервера",
};

export const serverClaimApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
