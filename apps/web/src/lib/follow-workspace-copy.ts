import type { Locale } from "./i18n";
const en = {
  title: "Saved and followed",
  description: "Manage the servers, people, organizations and resources you follow.",
  all: "All",
  user: "People",
  organization: "Organizations",
  server: "Servers",
  product: "Resources",
  search: "Search your follows",
  submit: "Search",
  clear: "Clear",
  empty: "No follows here",
  emptyHint: "Follow a profile or server to find it here.",
  unavailableTarget: "This target is no longer available",
  removed: "Removed from your follows.",
  remove: "Remove",
  removing: "Removing…",
  older: "Older follows",
  previous: "Previous",
  page: "Page",
  loading: "Loading…",
  retry: "Try again",
  latest: "Refresh latest",
  savedAt: "Followed",
  follow: "Follow",
  following: "Following",
  unfollow: "Unfollow",
  saving: "Saving…",
  checking: "Checking…",
  signIn: "Sign in to follow",
  self: "Your profile",
  success: "Follow state saved.",
  error: "Could not complete the request. Please try again.",
  invalid: "Invalid follow request.",
  notFound: "This target is unavailable. You can still remove an existing follow.",
  forbidden: "This action is unavailable.",
  rate: "Too many follow requests. Please try again shortly.",
  unconfirmed: "The result could not be confirmed. Refresh the state before trying again.",
  discover: "Discover profiles and servers",
  refreshing: "Refreshing…",
  pageError: "Could not load your follows.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Сохранённое и подписки",
  description: "Управляйте подписками на серверы, людей, организации и ресурсы.",
  all: "Все",
  user: "Люди",
  organization: "Организации",
  server: "Серверы",
  product: "Ресурсы",
  search: "Поиск по подпискам",
  submit: "Найти",
  clear: "Сбросить",
  empty: "Здесь пока нет подписок",
  emptyHint: "Подпишитесь на профиль или сервер, чтобы найти его здесь.",
  unavailableTarget: "Объект больше недоступен",
  removed: "Подписка удалена.",
  remove: "Удалить",
  removing: "Удаление…",
  older: "Ранние подписки",
  previous: "Назад",
  page: "Страница",
  loading: "Загрузка…",
  retry: "Повторить",
  latest: "Обновить список",
  savedAt: "Подписка от",
  follow: "Подписаться",
  following: "Вы подписаны",
  unfollow: "Отписаться",
  saving: "Сохранение…",
  checking: "Проверка…",
  signIn: "Войдите, чтобы подписаться",
  self: "Ваш профиль",
  success: "Состояние подписки сохранено.",
  error: "Не удалось выполнить запрос. Попробуйте ещё раз.",
  invalid: "Некорректный запрос подписки.",
  notFound: "Объект недоступен. Существующую подписку можно удалить.",
  forbidden: "Это действие недоступно.",
  rate: "Слишком много действий с подписками. Попробуйте чуть позже.",
  unconfirmed: "Результат не подтверждён. Обновите состояние перед повторной попыткой.",
  discover: "Найти профили и серверы",
  refreshing: "Обновление…",
  pageError: "Не удалось загрузить подписки.",
};
export const followCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function followError(locale: Locale, code: unknown) {
  const copy = followCopy(locale);
  switch (code) {
    case "UNAUTHORIZED":
      return copy.signIn;
    case "SELF_FOLLOW":
      return copy.self;
    case "NOT_FOUND":
      return copy.notFound;
    case "FORBIDDEN":
      return copy.forbidden;
    case "RATE_LIMIT_EXCEEDED":
      return copy.rate;
    case "UNCONFIRMED":
      return copy.unconfirmed;
    case "VALIDATION_ERROR":
    case "UNSUPPORTED_MEDIA_TYPE":
    case "REQUEST_BODY_TOO_LARGE":
    case "INVALID_BODY_LENGTH":
      return copy.invalid;
    default:
      return copy.error;
  }
}
