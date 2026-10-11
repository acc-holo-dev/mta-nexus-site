import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
const en = {
  title: "Publication reactions",
  helpful: "Helpful",
  thanks: "Thank you",
  insight: "Insightful",
  choose: "React to this publication",
  remove: "Remove reaction",
  own: "Your publication: reactions from other readers are shown here.",
  signIn: "Sign in to react",
  loading: "Loading reactions…",
  saving: "Saving…",
  saved: "Reaction saved.",
  removed: "Reaction removed.",
  unavailable: "Unable to load reactions. Try again.",
  uncertain: "The result is not confirmed. Reload the saved state before trying again.",
  reload: "Reload saved state",
  invalid: "Invalid reaction or page. Open the latest page to continue.",
  my: "My reactions",
  description:
    "Your reactions to articles and community publications. You can remove reactions even when a publication is no longer available.",
  query: "Search publication titles",
  all: "All reactions",
  search: "Search",
  reset: "Clear filters",
  latest: "Latest reactions",
  next: "Older reactions",
  empty: "You have not reacted to any publications yet.",
  emptyFiltered: "No reactions match these filters.",
  hidden: "Publication unavailable",
  hiddenDescription: "The publication was removed or is no longer public.",
  scope: "Reactions express reader feedback. Verification is reviewed separately.",
  back: "Back to workspace",
};
const ru: Record<keyof typeof en, string> = {
  title: "Реакции на публикации",
  helpful: "Полезно",
  thanks: "Спасибо",
  insight: "Интересная мысль",
  choose: "Оцените публикацию",
  remove: "Удалить реакцию",
  own: "Ваша публикация: здесь показаны реакции других читателей.",
  signIn: "Войдите, чтобы оставить реакцию",
  loading: "Загрузка реакций…",
  saving: "Сохранение…",
  saved: "Реакция сохранена.",
  removed: "Реакция удалена.",
  unavailable: "Не удалось загрузить реакции. Попробуйте ещё раз.",
  uncertain: "Результат не подтверждён. Загрузите сохранённое состояние перед повторной попыткой.",
  reload: "Загрузить сохранённое состояние",
  invalid: "Некорректная реакция или страница. Откройте страницу новых реакций, чтобы продолжить.",
  my: "Мои реакции",
  description:
    "Ваши реакции на статьи и публикации сообщества. Реакции можно удалить, даже если публикация больше недоступна.",
  query: "Поиск по названиям публикаций",
  all: "Все реакции",
  search: "Найти",
  reset: "Сбросить фильтры",
  latest: "Новые реакции",
  next: "Старые реакции",
  empty: "Вы пока не оставили реакций на публикации.",
  emptyFiltered: "По этим фильтрам реакций нет.",
  hidden: "Публикация недоступна",
  hiddenDescription: "Публикация удалена или больше не является публичной.",
  scope: "Реакции отражают мнение читателей. Верификация проходит отдельную проверку.",
  back: "К кабинету",
};
export const reactionCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function reactionError(locale: Locale, code: unknown) {
  if (code === "VALIDATION_ERROR" || code === "INVALID_CURSOR") return reactionCopy(locale).invalid;
  if (code === "REACTION_SELF") return reactionCopy(locale).own;
  if (code === "UNCONFIRMED") return reactionCopy(locale).uncertain;
  if (code === "INTERNAL_ERROR") return reactionCopy(locale).unavailable;
  return userPlatformError(locale, code);
}
