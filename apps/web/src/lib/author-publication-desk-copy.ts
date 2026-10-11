import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";

const en = {
  forbidden: "Your current organization or server rights do not allow restoration.",
  title: "Publication studio",
  description:
    "Search your publications, inspect their status history and resume your own archived work.",
  query: "Title, URL, text or tag",
  tag: "Exact tag",
  source: "Publication context",
  all: "All",
  personal: "Personal",
  organization: "Organization",
  server: "Server",
  search: "Search",
  reset: "Reset",
  latest: "Latest changes",
  older: "Older changes",
  newer: "Newer changes",
  empty: "No matching publications on this page.",
  history: "Status history",
  historyDescription:
    "Retained creation, editing and status events for your publication. Private moderation notes and account details are not included.",
  historyEmpty: "No retained events yet.",
  historyOlder: "Earlier events",
  historyLatest: "Latest events",
  actorAuthor: "Author",
  actorTeam: "Context editor",
  actorModeration: "Moderation",
  created: "Created",
  edited: "Edited",
  published: "Published",
  archived: "Archived",
  restored: "Restored to draft",
  restore: "Restore to draft",
  restoreConfirm:
    "Restore your own archived publication to a draft? This does not publish it. Its text and replies will remain.",
  restoredNotice: "The publication was restored to a draft. Open its editor to continue.",
  restoreHelp:
    "Only a current archive recorded by your own author action can be restored here. Older archives, team archives and moderation decisions require support.",
  uncertain: "The saved state could not be confirmed. Reload before another action.",
  reload: "Reload saved version",
  invalid: "Invalid filters or continuation. Start from the latest page.",
  unavailable: "The publication studio is temporarily unavailable. Try again.",
  restoreDenied: "This archive cannot be restored by the author. Contact support.",
  conflict: "The publication changed. Reload its saved state.",
  loading: "Loading publications…",
  live: "Pages show current data. Editing a publication moves it to the latest changes.",
  support: "Contact support",
};
const ru: typeof en = {
  forbidden: "Текущие права на организацию или сервер не позволяют восстановить публикацию.",
  title: "Кабинет публикаций",
  description:
    "Ищите свои материалы, просматривайте историю статусов и возвращайтесь к собственным архивным публикациям.",
  query: "Название, URL, текст или тег",
  tag: "Точный тег",
  source: "Контекст публикации",
  all: "Все",
  personal: "Личная",
  organization: "Организация",
  server: "Сервер",
  search: "Найти",
  reset: "Сбросить",
  latest: "Последние изменения",
  older: "Более ранние изменения",
  newer: "Более поздние изменения",
  empty: "На этой странице нет подходящих публикаций.",
  history: "История статусов",
  historyDescription:
    "Сохранённые события создания, редактирования и изменения статуса вашей публикации. Внутренние заметки модерации и данные аккаунтов скрыты.",
  historyEmpty: "Сохранённых событий пока нет.",
  historyOlder: "Ранние события",
  historyLatest: "Последние события",
  actorAuthor: "Автор",
  actorTeam: "Редактор контекста",
  actorModeration: "Модерация",
  created: "Создано",
  edited: "Изменено",
  published: "Опубликовано",
  archived: "В архиве",
  restored: "Восстановлено в черновик",
  restore: "Восстановить в черновик",
  restoreConfirm:
    "Восстановить вашу архивную публикацию в черновик? Она не будет опубликована. Текст и ответы сохранятся.",
  restoredNotice:
    "Публикация восстановлена в черновик. Откройте редактор, чтобы продолжить работу.",
  restoreHelp:
    "Здесь можно восстановить только текущий архив, сохранённый вашим собственным действием автора. Для старых архивов, действий команды и решений модерации обратитесь в поддержку.",
  uncertain:
    "Сохранённое состояние не удалось подтвердить. Обновите страницу перед следующим действием.",
  reload: "Загрузить сохранённую версию",
  invalid: "Некорректные фильтры или переход. Откройте последние записи.",
  unavailable: "Кабинет публикаций временно недоступен. Попробуйте ещё раз.",
  restoreDenied: "Этот архив нельзя восстановить самостоятельно. Обратитесь в поддержку.",
  conflict: "Публикация изменилась. Загрузите сохранённое состояние.",
  loading: "Загрузка публикаций…",
  live: "Страницы показывают текущее состояние. После редактирования публикация перемещается к последним изменениям.",
  support: "Обратиться в поддержку",
};
export const authorPublicationDeskCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function authorPublicationDeskError(locale: Locale, code: unknown) {
  const copy = authorPublicationDeskCopy(locale);
  if (code === "FORBIDDEN") return copy.forbidden;
  if (code === "VALIDATION_ERROR" || code === "INVALID_CURSOR") return copy.invalid;
  if (code === "PUBLICATION_RESTORE_DENIED") return copy.restoreDenied;
  if (code === "CONFLICT") return copy.conflict;
  if (code === "INTERNAL_ERROR") return copy.unavailable;
  return userPlatformError(locale, code);
}
