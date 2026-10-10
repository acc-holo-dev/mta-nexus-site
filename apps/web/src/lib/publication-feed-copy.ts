import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
const en = {
  title: "Following feed",
  description: "Public publications from the people, teams, servers and resources you follow.",
  activity: "Publications",
  publicDescription: "Published articles, updates and community discussions.",
  back: "Back to profile",
  signIn: "Sign in to see your feed",
  manage: "Manage follows",
  discover: "Find creators and teams",
  all: "All",
  user: "People",
  organization: "Organizations",
  server: "Servers",
  product: "Resources",
  source: "Followed source",
  type: "Publication type",
  query: "Search publications",
  search: "Search",
  reset: "Clear filters",
  latest: "Show latest",
  previous: "Previous page",
  next: "Older publications",
  loading: "Loading…",
  error: "Unable to load publications. Try again.",
  empty: "No publications here yet.",
  emptyFollowing: "Follow people, teams, servers or resources to see their public updates here.",
  emptyFiltered: "No publications match these filters.",
  comments: "Comments",
  invalid: "Invalid publication filters or page. Reload the feed.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Лента подписок",
  description:
    "Публичные публикации авторов, команд, серверов и ресурсов, на которые вы подписаны.",
  activity: "Публикации",
  publicDescription: "Опубликованные статьи, новости и обсуждения сообщества.",
  back: "К профилю",
  signIn: "Войдите, чтобы увидеть свою ленту",
  manage: "Управление подписками",
  discover: "Найти авторов и команды",
  all: "Все",
  user: "Авторы",
  organization: "Организации",
  server: "Серверы",
  product: "Ресурсы",
  source: "Источник подписки",
  type: "Тип публикации",
  query: "Поиск публикаций",
  search: "Найти",
  reset: "Сбросить фильтры",
  latest: "Показать новые",
  previous: "Предыдущая страница",
  next: "Старые публикации",
  loading: "Загрузка…",
  error: "Не удалось загрузить публикации. Попробуйте ещё раз.",
  empty: "Публикаций пока нет.",
  emptyFollowing:
    "Подпишитесь на авторов, команды, серверы или ресурсы, чтобы видеть их публичные новости.",
  emptyFiltered: "По этим фильтрам публикаций нет.",
  comments: "Комментарии",
  invalid: "Некорректные фильтры или страница. Перезагрузите ленту.",
};
export const publicationCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function publicationError(locale: Locale, code: unknown) {
  if (code === "VALIDATION_ERROR" || code === "INVALID_CURSOR")
    return publicationCopy(locale).invalid;
  if (code === "UNCONFIRMED" || code === "INTERNAL_ERROR") return publicationCopy(locale).error;
  return userPlatformError(locale, code);
}
