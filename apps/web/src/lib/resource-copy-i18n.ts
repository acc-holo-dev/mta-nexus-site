import type { Locale } from "./i18n";

const en = {
  title: "Copy into a new draft",
  history: "Draft copies",
  recorded: "Recorded copy",
  back: "Manage source",
  target: "Manage new resource",
  notice:
    "Only the description, tags, type and compatibility requirements are copied. The new resource stays with the same publisher. Files, versions, gallery, variants, reviews, sales, licenses and approval are not copied. Upload files and pass review separately.",
  personal: "Personal publisher",
  organization: "Organization publisher",
  source: "Source",
  name: "New title",
  slug: "New address",
  create: "Create independent draft",
  busy: "Creating…",
  retry:
    "Result could not be confirmed. Retry the same request to avoid duplicates, or check draft copy history.",
  frozen:
    "This request is fixed for safe retries. Reload after checking history to start a different copy.",
  invalid: "Check the title and lowercase address (letters, numbers and single hyphens).",
  changed: "The source changed. Reload and review its current details before creating a new copy.",
  conflict: "This request was already used with different details. Check copy history.",
  taken: "This address is already used. Check history, then reload to choose another address.",
  limit: "The source has reached its limit of 50 draft copies.",
  restricted: "This source cannot currently be copied.",
  metadataInvalid: "The source metadata must be corrected before copying.",
  forbidden: "Your account needs permission to create resources and manage this publisher.",
  unavailable: "The resource or recorded copy is unavailable to your account.",
  slow: "Too many requests. Wait and retry.",
  signInRequired: "Sign in to manage resources",
  signIn: "Sign in",
  empty: "No accessible draft copies in this period.",
  period: "Period",
  all: "All time",
  days: "days",
  filter: "Apply",
  previous: "Previous",
  next: "Next",
  total: "Copies",
  created: "Created",
  current: "Current state of the new resource",
  atCreation: "Created as an unreviewed draft",
  snapshot: "Metadata recorded at creation",
  description: "Description",
  shortDescription: "Short description",
  type: "Type",
  tags: "Tags",
  minimum: "Minimum MTA version",
  dependencies: "Dependencies",
  none: "None specified",
  export: "Download recorded copy as JSON",
  types: {
    script: "Script",
    vehicle: "Vehicle",
    model: "Model",
    map: "Map",
    ui: "Interface",
    plugin: "Plugin",
    api: "API",
    bundle: "Bundle",
    service: "Service",
  },
  statuses: {
    draft: "Draft",
    pending_review: "Under review",
    published: "Published",
    suspended: "Suspended",
    archived: "Archived",
  },
};
const ru: typeof en = {
  title: "Копировать в новый черновик",
  history: "Копии черновиков",
  recorded: "Сохранённая копия",
  back: "Управлять исходником",
  target: "Управлять новым ресурсом",
  notice:
    "Копируются только описание, теги, тип и требования совместимости. Новый ресурс остаётся у того же автора или организации. Файлы, версии, галерея, варианты, отзывы, продажи, лицензии и одобрение не переносятся. Загрузите файлы и пройдите проверку отдельно.",
  personal: "Личный ресурс автора",
  organization: "Ресурс организации",
  source: "Исходник",
  name: "Новое название",
  slug: "Новый адрес",
  create: "Создать отдельный черновик",
  busy: "Создание…",
  retry:
    "Результат не удалось подтвердить. Повторите тот же запрос без создания дублей или проверьте историю копий.",
  frozen:
    "Данные запроса зафиксированы для безопасного повтора. Проверьте историю и обновите страницу, чтобы создать другую копию.",
  invalid: "Проверьте название и адрес: строчные латинские буквы, цифры и одиночные дефисы.",
  changed:
    "Исходник изменился. Обновите страницу и проверьте актуальные данные перед созданием копии.",
  conflict: "Этот запрос уже использован с другими данными. Проверьте историю копий.",
  taken: "Этот адрес уже занят. Проверьте историю и обновите страницу, чтобы выбрать другой адрес.",
  limit: "Для исходника достигнут предел в 50 копий черновиков.",
  restricted: "Этот исходник сейчас нельзя копировать.",
  metadataInvalid: "Перед копированием исправьте данные исходника.",
  forbidden:
    "Аккаунту нужны права на создание ресурсов и управление этим автором или организацией.",
  unavailable: "Ресурс или сохранённая копия недоступны вашему аккаунту.",
  slow: "Слишком много запросов. Подождите и повторите.",
  signInRequired: "Войдите для управления ресурсами",
  signIn: "Войти",
  empty: "За этот период нет доступных копий черновиков.",
  period: "Период",
  all: "Всё время",
  days: "дней",
  filter: "Применить",
  previous: "Назад",
  next: "Далее",
  total: "Копий",
  created: "Создано",
  current: "Текущее состояние нового ресурса",
  atCreation: "Создан как черновик, требующий проверки",
  snapshot: "Данные на момент создания",
  description: "Описание",
  shortDescription: "Краткое описание",
  type: "Тип",
  tags: "Теги",
  minimum: "Минимальная версия MTA",
  dependencies: "Зависимости",
  none: "Не указано",
  export: "Скачать сохранённую копию в JSON",
  types: {
    script: "Скрипт",
    vehicle: "Транспорт",
    model: "Модель",
    map: "Карта",
    ui: "Интерфейс",
    plugin: "Плагин",
    api: "API",
    bundle: "Набор",
    service: "Сервис",
  },
  statuses: {
    draft: "Черновик",
    pending_review: "На проверке",
    published: "Опубликован",
    suspended: "Приостановлен",
    archived: "В архиве",
  },
};
export const resourceCopyCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function resourceCopyError(locale: Locale, code: unknown) {
  const c = resourceCopyCopy(locale);
  switch (code) {
    case "RESOURCE_COPY_INVALID":
      return c.invalid;
    case "RESOURCE_COPY_SOURCE_CHANGED":
      return c.changed;
    case "RESOURCE_COPY_REQUEST_CONFLICT":
      return c.conflict;
    case "RESOURCE_COPY_SLUG_TAKEN":
      return c.taken;
    case "RESOURCE_COPY_LIMIT":
      return c.limit;
    case "RESOURCE_COPY_SOURCE_RESTRICTED":
      return c.restricted;
    case "RESOURCE_COPY_METADATA_INVALID":
      return c.metadataInvalid;
    case "RESOURCE_COPY_CREATE_FORBIDDEN":
    case "FORBIDDEN":
      return c.forbidden;
    case "UNAUTHORIZED":
      return c.signInRequired;
    case "NOT_FOUND":
    case "RESOURCE_COPY_TERMS_UNKNOWN":
      return c.unavailable;
    case "RATE_LIMIT_EXCEEDED":
      return c.slow;
    default:
      return c.retry;
  }
}
