import type { Locale } from "./i18n";

const en = {
  title: "Profile privacy",
  description: "Choose what visitors can see on your user and developer profiles.",
  activity: "Show my publication activity",
  activityDescription:
    "Controls only your personal publication feed and appearances in other users' followed-user feeds. It does not hide your public resources, servers, trust page, bio or author attribution.",
  contacts: "Show professional contacts",
  contactsDescription:
    "Show your portfolio URL and Discord contact on your user and developer profiles. Specialties and verified experience stay public. This is not a private account or block-user control.",
  scope:
    "These settings do not make published content private. Public authored resources, servers, publications, author attribution and your profile description stay visible and do not auto-hide when you change these toggles.",
  save: "Save privacy settings",
  saved: "Privacy settings saved.",
  reload: "Load saved settings",
  reloadHint:
    "Loading saved settings replaces unsaved toggle choices. Use refresh version after a conflict to keep your local choices and only update the form revision.",
  refreshVersion: "Refresh version",
  refreshVersionHint:
    "Updates only the shared profile revision so you can save again. Your current toggle choices stay selected.",
  loading: "Loading privacy settings…",
  signIn: "Sign in to manage profile privacy",
  back: "Account settings",
  publicProfile: "View public profile",
  guestPreview: "Guest preview",
  guestPreviewNote:
    "What a visitor sees with your current choices. Owner-only controls stay hidden. Public resources and servers remain listed.",
  guestPreviewActivityOn: "Publication activity link: visible",
  guestPreviewActivityOff: "Publication activity link: hidden",
  guestPreviewContactsOn: "Professional contacts: visible on public profiles",
  guestPreviewContactsOff: "Professional contacts: omitted from public profile data",
  guestPreviewAlways:
    "Always visible to guests: bio, resources, servers, trust, specialties and verified experience.",
  openGuestPreview: "Open guest preview of public profile",
  professional: "Edit professional profile",
  invalid: "Choose both visibility settings and load the current profile version.",
  conflict:
    "Your profile changed in another form or session. Your current toggle choices are kept — refresh the version, then save again.",
  unavailable: "Privacy settings are temporarily unavailable. Try loading them again.",
  uncertain:
    "The save could not be confirmed. Refresh the version or load saved settings to check the result before trying again.",
  unconfirmed:
    "The server did not confirm the saved settings. Refresh the version or load saved settings to check the result.",
  forbidden: "Your current session cannot change these settings.",
  accountChanged: "The signed-in account changed. Load its privacy settings before editing.",
  retry: "The settings were not saved. Please try again.",
  notFound: "This account is no longer available.",
  rate: "Too many requests. Wait a moment and try again.",
};
const ru: typeof en = {
  title: "Приватность профиля",
  description:
    "Выберите, что посетители видят в вашем пользовательском и профессиональном профиле.",
  activity: "Показывать мою ленту публикаций",
  activityDescription:
    "Управляет только персональной лентой публикаций и появлением в лентах подписок других пользователей. Не скрывает публичные ресурсы, серверы, страницу доверия, описание профиля и авторство.",
  contacts: "Показывать профессиональные контакты",
  contactsDescription:
    "Показывать ссылку на портфолио и контакт Discord в пользовательском и профессиональном профиле. Специализации и подтверждённый опыт остаются публичными. Это не полный private account и не блокировка пользователя.",
  scope:
    "Эти настройки не делают опубликованный контент приватным. Публичные ресурсы, серверы, публикации, авторство и описание профиля остаются видимыми и не скрываются автоматически при смене этих переключателей.",
  save: "Сохранить приватность",
  saved: "Настройки приватности сохранены.",
  reload: "Загрузить сохранённые настройки",
  reloadHint:
    "Загрузка сохранённых настроек заменит несохранённый выбор переключателей. После конфликта используйте обновление версии, чтобы сохранить локальный выбор и обновить только редакцию формы.",
  refreshVersion: "Обновить версию",
  refreshVersionHint:
    "Обновляет только общую редакцию профиля, чтобы снова сохранить. Текущий выбор переключателей остаётся.",
  loading: "Загрузка настроек приватности…",
  signIn: "Войдите, чтобы настроить приватность профиля",
  back: "Настройки аккаунта",
  publicProfile: "Открыть публичный профиль",
  guestPreview: "Просмотр от лица гостя",
  guestPreviewNote:
    "Что видит посетитель при текущем выборе. Элементы только для владельца скрыты. Публичные ресурсы и серверы остаются в списке.",
  guestPreviewActivityOn: "Ссылка на ленту публикаций: видна",
  guestPreviewActivityOff: "Ссылка на ленту публикаций: скрыта",
  guestPreviewContactsOn: "Профессиональные контакты: видны в публичных профилях",
  guestPreviewContactsOff: "Профессиональные контакты: отсутствуют в публичных данных профиля",
  guestPreviewAlways:
    "Гостю всегда видны: описание, ресурсы, серверы, доверие, специализации и подтверждённый опыт.",
  openGuestPreview: "Открыть публичный профиль как гость",
  professional: "Редактировать профессиональный профиль",
  invalid: "Выберите оба параметра видимости и загрузите актуальную версию профиля.",
  conflict:
    "Профиль изменён в другой форме или сессии. Текущий выбор переключателей сохранён — обновите версию и сохраните снова.",
  unavailable: "Настройки приватности временно недоступны. Попробуйте загрузить их снова.",
  uncertain:
    "Не удалось подтвердить сохранение. Обновите версию или загрузите сохранённые настройки и проверьте результат перед повторной попыткой.",
  unconfirmed:
    "Сервер не подтвердил сохранённые настройки. Обновите версию или загрузите их и проверьте результат.",
  forbidden: "Текущая сессия не позволяет изменить эти настройки.",
  accountChanged: "Аккаунт изменился. Загрузите его настройки приватности перед редактированием.",
  retry: "Настройки не сохранены. Попробуйте ещё раз.",
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
    case "ACCOUNT_CHANGED":
      return copy.accountChanged;
    case "PRIVACY_SAVE_RETRY":
      return copy.retry;
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
