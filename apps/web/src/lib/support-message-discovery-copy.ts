import type { Locale } from "./i18n";
import { supportWorkspaceError } from "./support-workspace-copy";

const en = {
  title: "Search conversation",
  description:
    "Find messages in this private support case. Pages contain up to 20 messages in chronological order.",
  search: "Message text",
  placeholder: "Search this conversation",
  apply: "Search",
  group: "Author",
  all: "Everyone",
  requester: "Requester",
  staff: "Support team",
  back: "Back to case",
  latest: "Latest messages",
  reset: "Reset filters",
  older: "Earlier messages",
  newer: "Later messages",
  navigation: "Conversation pages",
  empty: "No messages match these filters.",
  download: "Download this page (JSON)",
  exportHelp:
    "The download includes the private message text on this page. Share it only with people you trust.",
  snapshot: "Conversation snapshot",
  link: "Link to message",
  focused: "Selected message",
  truncated:
    "This older message exceeds the current limit; only its first 4,000 characters are shown.",
  loading: "Loading conversation…",
  invalid: "The search parameters are invalid. Reset the filters and try again.",
  expired: "The conversation page is no longer available. Open the latest messages.",
  missing: "This message is no longer available in this case.",
  unavailable: "The conversation could not be loaded. Please try again.",
};
const ru: typeof en = {
  title: "Поиск в переписке",
  description:
    "Поиск сообщений в этом личном обращении. На странице до 20 сообщений в хронологическом порядке.",
  search: "Текст сообщения",
  placeholder: "Поиск в этом обращении",
  apply: "Найти",
  group: "Автор",
  all: "Все",
  requester: "Заявитель",
  staff: "Поддержка",
  back: "Вернуться к обращению",
  latest: "Последние сообщения",
  reset: "Сбросить фильтры",
  older: "Более ранние",
  newer: "Более поздние",
  navigation: "Страницы переписки",
  empty: "По этим фильтрам сообщения не найдены.",
  download: "Скачать эту страницу (JSON)",
  exportHelp:
    "Выгрузка содержит личный текст сообщений этой страницы. Передавайте её только людям, которым доверяете.",
  snapshot: "Снимок переписки",
  link: "Ссылка на сообщение",
  focused: "Выбранное сообщение",
  truncated: "Это старое сообщение превышает текущий лимит; показаны первые 4000 символов.",
  loading: "Загрузка переписки…",
  invalid: "Некорректные параметры поиска. Сбросьте фильтры и повторите попытку.",
  expired: "Эта страница переписки больше недоступна. Откройте последние сообщения.",
  missing: "Это сообщение больше недоступно в данном обращении.",
  unavailable: "Не удалось загрузить переписку. Повторите попытку.",
};
export const supportMessageCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function supportMessageError(locale: Locale, code: unknown) {
  const copy = supportMessageCopy(locale);
  if (code === "CHANGE_HISTORY_FILTER_INVALID" || code === "INVALID_CURSOR") return copy.invalid;
  if (code === "SUPPORT_MESSAGES_EXPIRED") return copy.expired;
  if (code === "SUPPORT_MESSAGE_NOT_FOUND") return copy.missing;
  return supportWorkspaceError(locale, code);
}
