import type { Locale } from "./i18n";
import { discussionMutationError } from "./content-discussion-copy";
const en = {
  title: "My comments",
  description:
    "Find your comments in publications and manage their saved text. Resource purchase reviews are in their separate workspace.",
  query: "Search your text or public publication titles",
  availability: "Publication availability",
  all: "All publications",
  available: "Public",
  unavailable: "Unavailable",
  search: "Search",
  reset: "Clear filters",
  latest: "Latest comments",
  next: "Older comments",
  empty: "You have not commented on publications yet.",
  emptyFiltered: "No comments match this page or its filters.",
  hidden: "Publication unavailable",
  hiddenNote:
    "The publication is no longer public. Its details are hidden; you can still remove your own comment.",
  open: "Manage comment",
  back: "Back to my comments",
  workspace: "Back to workspace",
  discussion: "Open in discussion",
  loading: "Loading your comments…",
  failed: "Your comments could not be loaded. Try again.",
  invalid: "Invalid comment page. Open the latest page to continue.",
  signIn: "Sign in to manage your comments",
  removed: "Your comment was removed. Replies remain.",
  edited: "Your comment changes were saved.",
  reload: "Reload saved state",
  readOnly: "This comment can be removed, but cannot be edited here.",
  privacy: "This list is private. Only your own publication comments appear here.",
  changed: "This comment changed or became unavailable. Reload its saved state before continuing.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Мои комментарии",
  description:
    "Находите свои комментарии к публикациям и управляйте сохранённым текстом. Отзывы о приобретённых ресурсах находятся в отдельном кабинете.",
  query: "Поиск по своему тексту и названиям публичных публикаций",
  availability: "Доступность публикации",
  all: "Все публикации",
  available: "Публичные",
  unavailable: "Недоступные",
  search: "Найти",
  reset: "Сбросить фильтры",
  latest: "Новые комментарии",
  next: "Старые комментарии",
  empty: "Вы пока не комментировали публикации.",
  emptyFiltered: "На этой странице нет комментариев по выбранным фильтрам.",
  hidden: "Публикация недоступна",
  hiddenNote:
    "Публикация больше не публичная. Её данные скрыты; свой комментарий по-прежнему можно удалить.",
  open: "Управление комментарием",
  back: "К моим комментариям",
  workspace: "К кабинету",
  discussion: "Открыть в обсуждении",
  loading: "Загрузка ваших комментариев…",
  failed: "Не удалось загрузить ваши комментарии. Попробуйте ещё раз.",
  invalid: "Некорректная страница комментариев. Откройте страницу новых комментариев.",
  signIn: "Войдите для управления своими комментариями",
  removed: "Ваш комментарий удалён. Ответы сохранены.",
  edited: "Изменения комментария сохранены.",
  reload: "Загрузить сохранённое состояние",
  readOnly: "Этот комментарий можно удалить, но нельзя редактировать здесь.",
  privacy: "Это личный список. Здесь только ваши комментарии к публикациям.",
  changed:
    "Комментарий изменился или стал недоступен. Загрузите сохранённое состояние перед продолжением.",
};
export const ownDiscussionCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function ownDiscussionError(locale: Locale, code: unknown) {
  if (code === "INVALID_CURSOR" || code === "VALIDATION_ERROR")
    return ownDiscussionCopy(locale).invalid;
  if (code === "DISCUSSION_UNAVAILABLE") return ownDiscussionCopy(locale).changed;
  if (code === "INTERNAL_ERROR") return ownDiscussionCopy(locale).failed;
  return discussionMutationError(locale, code);
}
