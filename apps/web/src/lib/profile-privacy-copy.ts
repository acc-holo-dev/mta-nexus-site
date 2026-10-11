import type { Locale } from "./i18n";
const en = {
  title: "Profile privacy",
  description: "Choose what visitors can see on your user and developer profiles.",
  activity: "Show my publication activity",
  activityDescription:
    "Allow visitors to open your personal publication feed and see your publications in their feed of followed users.",
  contacts: "Show professional contacts",
  contactsDescription:
    "Show your portfolio URL and Discord contact on your user and developer profiles. Your specialties and verified experience remain public.",
  scope:
    "These settings do not make published content private. Publications remain available through community pages, direct links and organization, server or resource feeds. Your public resources, servers, author attribution and profile description remain visible.",
  save: "Save privacy settings",
  saved: "Privacy settings saved.",
  reload: "Load saved settings",
  reloadHint:
    "Loading saved settings replaces unsaved changes. Profile and professional profile edits also change this form's version.",
  loading: "Loading privacy settings…",
  signIn: "Sign in to manage profile privacy",
  back: "Account settings",
  publicProfile: "View public profile",
  professional: "Edit professional profile",
  invalid: "Choose both visibility settings and load the current profile version.",
  conflict:
    "Your profile changed in another form or session. Load saved settings before saving again.",
  unavailable: "Privacy settings are temporarily unavailable. Try loading them again.",
  uncertain:
    "The save could not be confirmed. Load saved settings to check the result before trying again.",
  unconfirmed:
    "The server did not confirm the saved settings. Load saved settings to check the result.",
  forbidden: "Your current session cannot change these settings.",
  notFound: "This account is no longer available.",
  rate: "Too many requests. Wait a moment and try again.",
};
const ru: typeof en = {
  title: "Приватность профиля",
  description:
    "Выберите, что посетители видят в вашем пользовательском и профессиональном профиле.",
  activity: "Показывать мою ленту публикаций",
  activityDescription:
    "Разрешить посетителям открывать персональную ленту и видеть ваши публикации в ленте подписок на пользователей.",
  contacts: "Показывать профессиональные контакты",
  contactsDescription:
    "Показывать ссылку на портфолио и контакт Discord в пользовательском и профессиональном профиле. Специализации и подтверждённый опыт остаются публичными.",
  scope:
    "Эти настройки не делают опубликованный контент приватным. Публикации доступны в сообществе, по прямым ссылкам и в лентах организаций, серверов или ресурсов. Публичные ресурсы, серверы, авторство и описание профиля остаются видимыми.",
  save: "Сохранить приватность",
  saved: "Настройки приватности сохранены.",
  reload: "Загрузить сохранённые настройки",
  reloadHint:
    "Загрузка сохранённых настроек заменит несохранённые изменения. Редактирование обычного или профессионального профиля также меняет версию этой формы.",
  loading: "Загрузка настроек приватности…",
  signIn: "Войдите, чтобы настроить приватность профиля",
  back: "Настройки аккаунта",
  publicProfile: "Открыть публичный профиль",
  professional: "Редактировать профессиональный профиль",
  invalid: "Выберите оба параметра видимости и загрузите актуальную версию профиля.",
  conflict:
    "Профиль изменён в другой форме или сессии. Загрузите сохранённые настройки перед повторным сохранением.",
  unavailable: "Настройки приватности временно недоступны. Попробуйте загрузить их снова.",
  uncertain:
    "Не удалось подтвердить сохранение. Загрузите сохранённые настройки и проверьте результат перед повторной попыткой.",
  unconfirmed: "Сервер не подтвердил сохранённые настройки. Загрузите их и проверьте результат.",
  forbidden: "Текущая сессия не позволяет изменить эти настройки.",
  notFound: "Этот аккаунт больше недоступен.",
  rate: "Слишком много запросов. Подождите немного и повторите попытку.",
};
export const profilePrivacyCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function profilePrivacyError(locale: Locale, code: unknown, mutation = false) {
  const copy = profilePrivacyCopy(locale);
  switch (code) {
    case "UNAUTHORIZED":
      return copy.signIn;
    case "FORBIDDEN":
      return copy.forbidden;
    case "NOT_FOUND":
      return copy.notFound;
    case "CONFLICT":
      return copy.conflict;
    case "RATE_LIMIT_EXCEEDED":
      return copy.rate;
    case "VALIDATION_ERROR":
    case "VALIDATION_FAILED":
    case "PAYLOAD_TOO_LARGE":
    case "REQUEST_BODY_TOO_LARGE":
    case "INVALID_BODY_LENGTH":
    case "UNSUPPORTED_MEDIA_TYPE":
      return copy.invalid;
    case "UNCONFIRMED":
      return copy.unconfirmed;
    default:
      return mutation ? copy.uncertain : copy.unavailable;
  }
}
export const profilePrivacyMutationError = (locale: Locale, code: unknown) =>
  profilePrivacyError(locale, code, true);
