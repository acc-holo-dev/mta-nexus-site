import type { Locale } from "../../lib/i18n";
import { supportWorkspaceCopy, supportWorkspaceError } from "./support-workspace-copy";

const en = {
  title: "Search conversation",
  description:
    "Find messages in this private support case. Pages contain up to 20 messages in chronological order.",
  search: "Message text",
  filters: "Conversation filters",
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
  empty: "No messages in this case yet.",
  emptyDescription: "Messages appear here after the requester or support team writes in this case.",
  emptyFiltered: "No messages match these filters.",
  emptyFilteredDescription: "Clear the filters to see the full conversation on this case.",
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
  invalidHint:
    "Invalid filters are not an empty conversation. Reset them to open the latest messages in this case.",
  expired: "The conversation page is no longer available. Open the latest messages.",
  expiredHint:
    "An expired page is not an empty conversation. Open the latest messages in this case.",
  missing: "This message is no longer available in this case.",
  missingHint:
    "A missing message is not an empty conversation. Return to the latest messages in this case.",
  unavailable: "The conversation could not be loaded. Please try again.",
  unavailableHint:
    "A load failure is not an empty conversation. Retry to fetch the latest messages in this case.",
  rateHint: "A rate limit is not an empty conversation. Wait, then open the latest messages.",
  authHint:
    "A session check failure is not an empty conversation. Sign in again, then open this case.",
};
const ru: typeof en = {
  title: "Поиск в переписке",
  description:
    "Поиск сообщений в этом личном обращении. На странице до 20 сообщений в хронологическом порядке.",
  search: "Текст сообщения",
  filters: "Фильтры переписки",
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
  empty: "В этом обращении пока нет сообщений.",
  emptyDescription:
    "Сообщения появятся здесь после того, как заявитель или поддержка напишут в этом обращении.",
  emptyFiltered: "По этим фильтрам сообщения не найдены.",
  emptyFilteredDescription: "Сбросьте фильтры, чтобы увидеть всю переписку по этому обращению.",
  download: "Скачать эту страницу (JSON)",
  exportHelp:
    "Выгрузка содержит личный текст сообщений этой страницы. Передавайте её только людям, которым доверяете.",
  snapshot: "Снимок переписки",
  link: "Ссылка на сообщение",
  focused: "Выбранное сообщение",
  truncated: "Это старое сообщение превышает текущий лимит; показаны первые 4000 символов.",
  loading: "Загрузка переписки…",
  invalid: "Некорректные параметры поиска. Сбросьте фильтры и повторите попытку.",
  invalidHint:
    "Некорректные фильтры — не пустая переписка. Сбросьте их, чтобы открыть последние сообщения в этом обращении.",
  expired: "Эта страница переписки больше недоступна. Откройте последние сообщения.",
  expiredHint:
    "Просроченная страница — не пустая переписка. Откройте последние сообщения в этом обращении.",
  missing: "Это сообщение больше недоступно в данном обращении.",
  missingHint:
    "Отсутствующее сообщение — не пустая переписка. Вернитесь к последним сообщениям в этом обращении.",
  unavailable: "Не удалось загрузить переписку. Повторите попытку.",
  unavailableHint:
    "Сбой загрузки — не пустая переписка. Повторите запрос, чтобы получить последние сообщения в этом обращении.",
  rateHint:
    "Ограничение частоты — не пустая переписка. Подождите и откройте последние сообщения.",
  authHint:
    "Сбой проверки сессии — не пустая переписка. Войдите снова и откройте это обращение.",
};
export const supportMessageCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function supportMessageError(locale: Locale, code: unknown) {
  const copy = supportMessageCopy(locale);
  if (code === "CHANGE_HISTORY_FILTER_INVALID" || code === "INVALID_CURSOR") return copy.invalid;
  if (code === "SUPPORT_MESSAGES_EXPIRED") return copy.expired;
  if (code === "SUPPORT_MESSAGE_NOT_FOUND") return copy.missing;
  return supportWorkspaceError(locale, code);
}

/** Recovery text for every conversation ErrorState. Never leaves the description blank. */
export function supportMessageErrorDescription(locale: Locale, title: string) {
  const copy = supportMessageCopy(locale);
  const workspace = supportWorkspaceCopy(locale);
  if (title === copy.invalid) return copy.invalidHint;
  if (title === copy.expired) return copy.expiredHint;
  if (title === copy.missing) return copy.missingHint;
  if (title === workspace.forbidden) return workspace.forbiddenHint;
  if (title === workspace.notFound) return workspace.notFoundHint;
  if (title === workspace.rate) return copy.rateHint;
  if (title === workspace.auth) return copy.authHint;
  return copy.unavailableHint;
}
