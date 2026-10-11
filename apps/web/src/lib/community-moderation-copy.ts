import type { Locale } from "./i18n";
const en = {
  title: "Publication moderation",
  description:
    "Review the full text and author context. Publish or archive the saved version with a recorded reason.",
  detail: "Review publication",
  search: "Title, text or author",
  author: "Exact author username",
  status: "Publication status",
  type: "Publication type",
  all: "All",
  draft: "Draft",
  published: "Published",
  archived: "Archived",
  apply: "Apply filters",
  reset: "Clear filters",
  latest: "Latest saved results",
  older: "Older results",
  history: "Recorded moderation decisions",
  historyScope:
    "This history shows retained publication and archive decisions. Author edits are outside its scope.",
  noHistory: "No retained moderation decisions on this page.",
  empty: "No matching publications.",
  unavailable: "Moderation data could not be loaded. Reload the saved version.",
  invalid: "Invalid filters or continuation. Reload the latest saved results.",
  denied: "A current administrator or moderator role is required.",
  signIn: "Sign in",
  loading: "Loading moderation workspace…",
  back: "Back to moderation",
  publicPage: "Open public publication",
  body: "Publication text",
  updated: "Saved version updated",
  created: "Created",
  reason: "Recorded reason",
  unknown: "No recorded value",
  publish: "Publish",
  archive: "Archive",
  saved: "The decision was saved. Reload the current version before another decision.",
  reload: "Reload saved version",
  uncertain: "The decision could not be confirmed. Reload saved state before retrying.",
  changed: "The publication changed. Reload and review the current version.",
  large:
    "This legacy text exceeds the full-preview limit. Publishing is blocked until the author shortens it. Archiving remains available.",
  already: "The publication already has the requested state.",
  rate: "Too many moderation requests. Try again shortly.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Модерация публикаций",
  description:
    "Проверьте полный текст и сведения об авторе. Опубликуйте или архивируйте сохранённую версию с записью причины.",
  detail: "Проверка публикации",
  search: "Заголовок, текст или автор",
  author: "Точный логин автора",
  status: "Статус публикации",
  type: "Тип публикации",
  all: "Все",
  draft: "Черновик",
  published: "Опубликовано",
  archived: "В архиве",
  apply: "Применить фильтры",
  reset: "Сбросить фильтры",
  latest: "Новые сохранённые результаты",
  older: "Более старые результаты",
  history: "Записанные решения модерации",
  historyScope:
    "В истории показаны сохранённые решения о публикации и архивации. Авторские правки сюда не входят.",
  noHistory: "На этой странице нет сохранённых решений модерации.",
  empty: "Подходящих публикаций нет.",
  unavailable: "Не удалось загрузить данные модерации. Загрузите сохранённую версию.",
  invalid: "Некорректные фильтры или продолжение. Загрузите новые сохранённые результаты.",
  denied: "Нужна действующая роль администратора или модератора.",
  signIn: "Войти",
  loading: "Загрузка кабинета модерации…",
  back: "К модерации",
  publicPage: "Открыть публичную публикацию",
  body: "Текст публикации",
  updated: "Обновление сохранённой версии",
  created: "Создано",
  reason: "Записанная причина",
  unknown: "Значение не записано",
  publish: "Опубликовать",
  archive: "Архивировать",
  saved: "Решение сохранено. Загрузите текущую версию перед следующим решением.",
  reload: "Загрузить сохранённую версию",
  uncertain: "Не удалось подтвердить решение. Загрузите сохранённое состояние перед повтором.",
  changed: "Публикация изменилась. Загрузите и проверьте текущую версию.",
  large:
    "Этот старый текст превышает лимит полного просмотра. Публикация заблокирована, пока автор не сократит текст. Архивация доступна.",
  already: "Публикация уже находится в нужном состоянии.",
  rate: "Слишком много запросов модерации. Попробуйте чуть позже.",
};
export const moderationCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export const moderationError = (locale: Locale, code: unknown) => {
  const copy = moderationCopy(locale);
  switch (code) {
    case "FORBIDDEN":
      return copy.denied;
    case "UNAUTHORIZED":
      return copy.signIn;
    case "VALIDATION_ERROR":
    case "INVALID_CURSOR":
      return copy.invalid;
    case "CONTENT_STATE_CHANGED":
      return copy.changed;
    case "CONTENT_ALREADY_IN_STATE":
      return copy.already;
    case "CONTENT_REVIEW_TOO_LARGE":
      return copy.large;
    case "RATE_LIMIT_EXCEEDED":
      return copy.rate;
    case "UNCONFIRMED":
      return copy.uncertain;
    default:
      return copy.unavailable;
  }
};
