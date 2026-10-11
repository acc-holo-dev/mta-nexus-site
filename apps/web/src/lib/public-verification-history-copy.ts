import type { Locale } from "./i18n";
import { trustError } from "./public-user-trust-copy";
const en = {
  title: "Recorded verification approvals",
  description: "Dated approval records retained by NEXUS. Current badges are shown separately.",
  back: "Back to current trust signals",
  profile: "Back to profile",
  all: "All approval types",
  type: "Approval type",
  user: "Identity",
  developer: "Developer experience",
  filter: "Apply filter",
  latest: "Latest records",
  older: "Older records",
  loading: "Loading approval records…",
  empty: "No dated approvals are recorded for this page and filter.",
  approved: "Approval recorded",
  scope:
    "These are retained approval records, not a full verification lifecycle. Pending and rejected applications, evidence and staff notes are private. An old approval does not establish current verification; a missing record does not imply rejection or misconduct.",
  unavailable: "Approval records could not be loaded. Try again.",
  invalid: "Invalid approval page. Open the latest records to continue.",
  current: "Current verification",
  verified: "Currently verified",
  unverified: "No current verification",
  reset: "Clear filter",
};
const ru: Record<keyof typeof en, string> = {
  title: "Записанные одобрения верификации",
  description:
    "Сохранённые в NEXUS записи одобрений с датами. Текущие подтверждения показаны отдельно.",
  back: "К текущим сведениям о доверии",
  profile: "К профилю",
  all: "Все типы одобрений",
  type: "Тип одобрения",
  user: "Личность",
  developer: "Опыт разработчика",
  filter: "Применить фильтр",
  latest: "Новые записи",
  older: "Старые записи",
  loading: "Загрузка записей одобрений…",
  empty: "На этой странице нет записанных одобрений по выбранному фильтру.",
  approved: "Одобрение записано",
  scope:
    "Это сохранённые записи одобрений, а не полный жизненный цикл верификации. Ожидающие и отклонённые заявки, доказательства и внутренние заметки приватны. Прошлое одобрение не подтверждает текущий статус; отсутствие записи не означает отказ или нарушение.",
  unavailable: "Не удалось загрузить записи одобрений. Попробуйте ещё раз.",
  invalid: "Некорректная страница одобрений. Откройте новые записи, чтобы продолжить.",
  current: "Подтверждение сейчас",
  verified: "Подтверждено сейчас",
  unverified: "Нет текущего подтверждения",
  reset: "Сбросить фильтр",
};
export const approvalCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export const approvalError = (locale: Locale, code: unknown) =>
  code === "INVALID_CURSOR" || code === "VALIDATION_ERROR"
    ? approvalCopy(locale).invalid
    : code === "INTERNAL_ERROR"
      ? approvalCopy(locale).unavailable
      : trustError(locale, code);
