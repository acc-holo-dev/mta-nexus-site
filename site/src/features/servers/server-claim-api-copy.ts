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
  instruction:
    "Temporarily add the exact token to the MTA server name, keep the server visible in the official master-list, then verify control before the challenge expires.",
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
  instruction:
    "Временно добавьте точный токен в имя MTA-сервера, оставьте сервер видимым в официальном master-list, затем подтвердите контроль до истечения задания.",
};

export const serverClaimApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
