import type { Locale } from "./i18n";
import { organizationError } from "./organization-workspace-copy";
const en = {
  legacyOwner: "Legacy owner role without ownership rights",
  title: "Team directory",
  description: "Find current team members and manage roles and delegated server access.",
  role: "Team role",
  access: "Effective server management",
  all: "All",
  yes: "Has access",
  no: "No access",
  other: "Other or legacy role",
  search: "Search team",
  reset: "Clear filters",
  latest: "Latest members",
  older: "Older members",
  ownerNote: "The current owner is shown separately and is not affected by member filters.",
  loading: "Loading team directory…",
  empty: "No team members match this page and its filters.",
  invalid: "Invalid team page. Open the latest members to continue.",
  unavailable: "The team directory could not be loaded. Try again.",
  uncertain: "Reload the saved team before making another change.",
  workspace: "Organization workspace",
  management: "Add members or manage ownership",
  transfer: "Select in ownership workspace",
  private:
    "This directory is available only to the current team. Effective server access includes administrator rights and accepted delegation; other permission flags remain private.",
};
const ru: Record<keyof typeof en, string> = {
  legacyOwner: "Устаревшая роль владельца без прав владения",
  title: "Каталог команды",
  description: "Находите действующих участников и управляйте ролями и доступом к серверам.",
  role: "Роль в команде",
  access: "Фактическое управление серверами",
  all: "Все",
  yes: "Есть доступ",
  no: "Нет доступа",
  other: "Другая или устаревшая роль",
  search: "Поиск по команде",
  reset: "Сбросить фильтры",
  latest: "Новые участники",
  older: "Ранее вступившие",
  ownerNote: "Текущий владелец показан отдельно и не зависит от фильтров участников.",
  loading: "Загрузка каталога команды…",
  empty: "На этой странице нет участников по выбранным фильтрам.",
  invalid: "Некорректная страница команды. Откройте список новых участников.",
  unavailable: "Не удалось загрузить каталог команды. Попробуйте ещё раз.",
  uncertain: "Загрузите сохранённую команду перед следующим изменением.",
  workspace: "Кабинет организации",
  management: "Добавление участников и управление владением",
  transfer: "Выбрать в кабинете владения",
  private:
    "Каталог доступен только действующей команде. Фактический доступ к серверам учитывает права администратора и допустимое делегирование; остальные разрешения приватны.",
};
export const organizationTeamCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export const organizationTeamError = (locale: Locale, code: unknown) =>
  code === "INVALID_CURSOR" || code === "VALIDATION_ERROR"
    ? organizationTeamCopy(locale).invalid
    : code === "INTERNAL_ERROR"
      ? organizationTeamCopy(locale).unavailable
      : organizationError(locale, code);
