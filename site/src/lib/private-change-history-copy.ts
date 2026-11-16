import type { Locale } from "./i18n";

const en = {
  loading: "Loading saved history…",
  profileTitle: "Profile change history",
  profileDescription:
    "Recorded changes to your public profile, professional details and privacy preferences.",
  privacy:
    "Only you can view this journal. It lists recorded field names without previous values, private contacts, network data or raw audit details.",
  recorded:
    "Records describe saved edit operations; they do not prove that every listed field had a different value.",
  unavailable: "Unable to load saved changes. Try again.",
  signIn: "Sign in to view your history.",
  rateLimited: "Too many requests. Try again later.",
  invalid: "Check the period, event group, search and history link.",
  expired: "This page is no longer available in the selected history. Open the latest events.",
  empty: "No recorded profile changes yet.",
  emptyHint: "Saved profile, professional and privacy edits appear here after they are recorded.",
  emptyFiltered: "No recorded changes match these filters.",
  emptyFilteredHint: "Try another period or event group, or open the latest matching events.",
  apply: "Apply filters",
  reset: "Reset filters",
  reload: "Try again",
  period: "Period",
  group: "Event group",
  search: "Search accounts",
  searchHelp: "Search current public names and usernames of the author or affected account.",
  periods: {
    all: "All retained history",
    "7": "7 days",
    "30": "30 days",
    "90": "90 days",
    "365": "365 days",
  },
  groups: {
    all: "All events",
    profile: "Public profile",
    professional: "Professional details",
    privacy: "Privacy",
    team: "Team access",
    ownership: "Ownership",
  },
  export: "Download this page as JSON",
  exportHelp:
    "Exports only this page with the same filters and cutoff. Current access is checked again.",
  until: "History cutoff",
  latest: "Latest matching events",
  older: "Earlier matching events",
  back: "Back to settings",
  fields: "Recorded fields",
  you: "You",
  system: "System or authorized process",
  invalidated:
    "This edit invalidated the previous experience verification. See your verification workspace.",
  verification: "Verification workspace",
  actions: {
    "user.profile_updated": "Public profile saved",
    "developer.profile_updated": "Professional profile saved",
    "user.privacy_updated": "Privacy preferences saved",
  },
  fieldNames: {
    displayName: "Display name",
    bio: "Biography",
    avatarUrl: "Avatar",
    specialties: "Specialties",
    githubUrl: "GitHub",
    discordTag: "Discord",
    showActivity: "Public activity visibility",
    showProfessionalContacts: "Professional contact visibility",
  },
};
const ru: typeof en = {
  loading: "Загрузка сохранённой истории…",
  profileTitle: "История изменений профиля",
  profileDescription:
    "Сохранённые изменения публичного профиля, профессиональных данных и настроек приватности.",
  privacy:
    "Этот журнал доступен только вам. Он содержит названия сохранённых полей без прежних значений, приватных контактов, сетевых данных и исходных записей аудита.",
  recorded:
    "Записи описывают сохранённые операции редактирования и не доказывают, что каждое перечисленное поле изменило значение.",
  unavailable: "Не удалось загрузить сохранённые изменения. Попробуйте ещё раз.",
  signIn: "Войдите, чтобы просматривать свою историю.",
  rateLimited: "Слишком много запросов. Попробуйте позже.",
  invalid: "Проверьте период, группу событий, поиск и ссылку истории.",
  expired: "Страница больше недоступна в выбранной истории. Откройте последние события.",
  empty: "Сохранённых изменений профиля пока нет.",
  emptyHint:
    "Здесь появляются сохранённые правки профиля, профессиональных данных и приватности после их записи.",
  emptyFiltered: "По этим фильтрам нет сохранённых изменений.",
  emptyFilteredHint:
    "Выберите другой период или группу событий либо откройте последние подходящие события.",
  apply: "Применить фильтры",
  reset: "Сбросить фильтры",
  reload: "Повторить",
  period: "Период",
  group: "Группа событий",
  search: "Поиск аккаунтов",
  searchHelp: "Поиск по текущим публичным именам и адресам автора или затронутого аккаунта.",
  periods: {
    all: "Вся сохранённая история",
    "7": "7 дней",
    "30": "30 дней",
    "90": "90 дней",
    "365": "365 дней",
  },
  groups: {
    all: "Все события",
    profile: "Публичный профиль",
    professional: "Профессиональные данные",
    privacy: "Приватность",
    team: "Доступ команды",
    ownership: "Владение",
  },
  export: "Скачать эту страницу в JSON",
  exportHelp:
    "Выгружается только эта страница с теми же фильтрами и временной границей. Доступ проверяется повторно.",
  until: "Временная граница истории",
  latest: "Последние события по фильтрам",
  older: "Более ранние события по фильтрам",
  back: "К настройкам",
  fields: "Сохранённые поля",
  you: "Вы",
  system: "Система или уполномоченный процесс",
  invalidated: "Эта операция отменила предыдущую верификацию опыта. Откройте кабинет верификации.",
  verification: "Кабинет верификации",
  actions: {
    "user.profile_updated": "Публичный профиль сохранён",
    "developer.profile_updated": "Профессиональный профиль сохранён",
    "user.privacy_updated": "Приватность сохранена",
  },
  fieldNames: {
    displayName: "Отображаемое имя",
    bio: "Описание",
    avatarUrl: "Аватар",
    specialties: "Специализации",
    githubUrl: "GitHub",
    discordTag: "Discord",
    showActivity: "Видимость публичной активности",
    showProfessionalContacts: "Видимость профессиональных контактов",
  },
};
export const privateChangeHistoryCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function privateChangeHistoryError(locale: Locale, code: unknown) {
  const copy = privateChangeHistoryCopy(locale);
  if (
    ["VALIDATION_ERROR", "CHANGE_HISTORY_FILTER_INVALID", "INVALID_CURSOR"].includes(String(code))
  )
    return copy.invalid;
  if (["CHANGE_HISTORY_EXPIRED", "ORGANIZATION_HISTORY_EXPIRED"].includes(String(code)))
    return copy.expired;
  if (code === "UNAUTHORIZED") return copy.signIn;
  if (code === "RATE_LIMIT_EXCEEDED") return copy.rateLimited;
  return copy.unavailable;
}
