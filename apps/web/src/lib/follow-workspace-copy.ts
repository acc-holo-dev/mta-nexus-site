import type { FollowTargetType } from "./follow-workspace-contract";
import type { Locale } from "./i18n";

const en = {
  title: "Saved and followed",
  description: "Manage the servers, people, organizations, resources and discussions you follow.",
  all: "All",
  user: "People",
  organization: "Organizations",
  server: "Servers",
  product: "Resources",
  content: "Discussions",
  replies: "Replies",
  latestReply: "Open latest reply",
  discussionHelp:
    "Save keeps a quiet bookmark. Watch discussion turns on comment notices for this publication. Mute/snooze suppresses follow and direct replies for this object only — it does not unfollow, and skipped events are not delivered later. Security and account notices are never muted this way.",
  savePublication: "Save publication",
  savedPublication: "Saved",
  removeSave: "Remove save",
  watchDiscussion: "Watch discussion",
  watchingDiscussion: "Watching discussion",
  stopWatchingDiscussion: "Stop comment notices",
  muteHelp: "Pause notices for this publication without unfollowing.",
  mute24h: "Mute 24 hours",
  mute7d: "Mute 7 days",
  mute30d: "Mute 30 days",
  unmute: "Unmute",
  mutedUntil: "Muted until",
  muteSuccess: "Mute updated.",
  quietSaveHint: "Saved quietly — comment notices stay off until you watch the discussion.",
  watchingHint: "You will get follow notices for new comments. Mute pauses them without removing the save.",
  notificationSettings: "Notification settings",
  search: "Search your follows",
  submit: "Search",
  clear: "Clear",
  empty: "No follows here",
  emptyHint: "Follow a profile or server to find it here.",
  emptyFiltered: "Nothing matches this filter",
  emptyFilteredHint: "Clear the type or search filter to see all follows again.",
  toCollection: "Add to collection",
  toCollectionHint: "Organizes this resource in a private collection. It does not turn on release-watch notifications.",
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
  self: "You cannot follow your own profile.",
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
  description: "Управляйте подписками на серверы, людей, организации, ресурсы и обсуждения.",
  all: "Все",
  user: "Люди",
  organization: "Организации",
  server: "Серверы",
  product: "Ресурсы",
  content: "Обсуждения",
  replies: "Ответов",
  latestReply: "Открыть последний ответ",
  discussionHelp:
    "«Сохранить» — тихая закладка. «Следить за обсуждением» включает уведомления о комментариях. Mute/snooze подавляет follow и прямые ответы только для этого объекта — без отписки, и пропущенные события потом не догоняются. Security и account notices так не глушатся.",
  savePublication: "Сохранить публикацию",
  savedPublication: "Сохранено",
  removeSave: "Убрать из сохранённого",
  watchDiscussion: "Следить за обсуждением",
  watchingDiscussion: "Следите за обсуждением",
  stopWatchingDiscussion: "Отключить уведомления о комментариях",
  muteHelp: "Приостановить уведомления по этой публикации без отписки.",
  mute24h: "Mute на 24 часа",
  mute7d: "Mute на 7 дней",
  mute30d: "Mute на 30 дней",
  unmute: "Снять mute",
  mutedUntil: "Mute до",
  muteSuccess: "Mute обновлён.",
  quietSaveHint: "Сохранено тихо — уведомления о комментариях выключены, пока не включите слежение.",
  watchingHint:
    "Вы получаете follow-уведомления о новых комментариях. Mute ставит паузу без удаления сохранения.",
  notificationSettings: "Настройки уведомлений",
  search: "Поиск по подпискам",
  submit: "Найти",
  clear: "Сбросить",
  empty: "Здесь пока нет подписок",
  emptyHint: "Подпишитесь на профиль или сервер, чтобы найти его здесь.",
  emptyFiltered: "По этому фильтру ничего нет",
  emptyFilteredHint: "Сбросьте тип или поиск, чтобы снова увидеть все подписки.",
  toCollection: "В коллекцию",
  toCollectionHint:
    "Добавляет ресурс в приватную коллекцию. Это не включает уведомления о новых версиях.",
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
  self: "Нельзя подписаться на собственный профиль.",
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

export type FollowActionCopy = {
  follow: string;
  following: string;
  unfollow: string;
  signIn: string;
  self: string;
  success: string;
  saving: string;
  checking: string;
  hint: string;
};

const actionEn: Record<FollowTargetType, FollowActionCopy> = {
  product: {
    follow: "Save",
    following: "Saved",
    unfollow: "Remove from saved",
    signIn: "Sign in to save",
    self: "You cannot save your own profile this way.",
    success: "Saved state confirmed.",
    saving: "Saving…",
    checking: "Checking…",
    hint: "Save keeps a link in your saved list. It does not turn on release-watch notifications.",
  },
  content: {
    follow: "Watch discussion",
    following: "Watching discussion",
    unfollow: "Stop watching",
    signIn: "Sign in to watch this discussion",
    self: "You cannot watch your own profile this way.",
    success: "Discussion watch updated.",
    saving: "Updating…",
    checking: "Checking…",
    hint: "Turns on comment notices for this publication. Quiet Save is separate; mute pauses follow and direct for this object only.",
  },
  user: {
    follow: "Follow person",
    following: "Following person",
    unfollow: "Unfollow person",
    signIn: "Sign in to follow",
    self: "You cannot follow your own profile.",
    success: "Follow state saved.",
    saving: "Saving…",
    checking: "Checking…",
    hint: "Adds this person to your follows list. It does not promise a full activity feed.",
  },
  organization: {
    follow: "Follow organization",
    following: "Following organization",
    unfollow: "Unfollow organization",
    signIn: "Sign in to follow",
    self: "You cannot follow your own profile.",
    success: "Follow state saved.",
    saving: "Saving…",
    checking: "Checking…",
    hint: "Keeps this organization in your follows. It does not promise every org event.",
  },
  server: {
    follow: "Follow server",
    following: "Following server",
    unfollow: "Unfollow server",
    signIn: "Sign in to follow",
    self: "You cannot follow your own profile.",
    success: "Follow state saved.",
    saving: "Saving…",
    checking: "Checking…",
    hint: "Keeps this server in your follows. It does not confirm that you joined or played.",
  },
};

const actionRu: Record<FollowTargetType, FollowActionCopy> = {
  product: {
    follow: "Сохранить",
    following: "Сохранено",
    unfollow: "Убрать из сохранённого",
    signIn: "Войдите, чтобы сохранить",
    self: "Так нельзя сохранить собственный профиль.",
    success: "Сохранение подтверждено.",
    saving: "Сохранение…",
    checking: "Проверка…",
    hint: "«Сохранить» добавляет ссылку в список сохранённого. Это не включает уведомления о новых версиях.",
  },
  content: {
    follow: "Следить за обсуждением",
    following: "Следите за обсуждением",
    unfollow: "Не следить",
    signIn: "Войдите, чтобы следить за обсуждением",
    self: "Так нельзя следить за собственным профилем.",
    success: "Подписка на обсуждение обновлена.",
    saving: "Обновление…",
    checking: "Проверка…",
    hint: "Включает уведомления о комментариях. Тихое «Сохранить» отдельно; mute ставит паузу только для этого объекта.",
  },
  user: {
    follow: "Подписаться на человека",
    following: "Вы подписаны",
    unfollow: "Отписаться",
    signIn: "Войдите, чтобы подписаться",
    self: "Нельзя подписаться на собственный профиль.",
    success: "Состояние подписки сохранено.",
    saving: "Сохранение…",
    checking: "Проверка…",
    hint: "Добавляет человека в список подписок. Полная лента событий не обещается.",
  },
  organization: {
    follow: "Подписаться на организацию",
    following: "Вы подписаны",
    unfollow: "Отписаться",
    signIn: "Войдите, чтобы подписаться",
    self: "Нельзя подписаться на собственный профиль.",
    success: "Состояние подписки сохранено.",
    saving: "Сохранение…",
    checking: "Проверка…",
    hint: "Держит организацию в подписках. Не обещает все события организации.",
  },
  server: {
    follow: "Подписаться на сервер",
    following: "Вы подписаны",
    unfollow: "Отписаться",
    signIn: "Войдите, чтобы подписаться",
    self: "Нельзя подписаться на собственный профиль.",
    success: "Состояние подписки сохранено.",
    saving: "Сохранение…",
    checking: "Проверка…",
    hint: "Держит сервер в подписках. Не подтверждает подключение или игру.",
  },
};

export const followCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function followActionCopy(locale: Locale, targetType: FollowTargetType): FollowActionCopy {
  return (locale === "ru" ? actionRu : actionEn)[targetType];
}
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
