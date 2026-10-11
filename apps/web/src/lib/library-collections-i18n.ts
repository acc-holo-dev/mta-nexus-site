const en = {
  title: "My resource collections",
  library: "Resource library",
  subtitle:
    "Group resources you have acquired. Collections are private and do not grant download rights.",
  name: "Collection name",
  create: "Create collection",
  duplicate: "Copy collection",
  copyNote:
    "Create an independent active collection with every reference from this revision, including unavailable resources. Version preferences and download rights are shared through your library and are not copied or changed.",
  copyConfirm: "I confirm the source revision and the full collection contents shown above.",
  source: "Source collection",
  rename: "Rename",
  archive: "Archive",
  restore: "Restore",
  add: "Add to collection",
  remove: "Remove from collection",
  "add-many": "Add selected resources",
  "remove-many": "Remove selected references",
  batchLimit: "Select up to 20 resources on this page. The whole operation commits together.",
  batchConfirm: "I confirm this selection and operation.",
  selected: "Selected",
  candidates: "Add acquired resources",
  history: "Change history",
  active: "Active",
  archived: "Archived",
  all: "All",
  empty: "No collections here yet.",
  emptyItems: "No matching resources.",
  archivedNote:
    "This collection is archived. Restore it to change its name or contents. Your resource rights and version preferences are preserved.",
  archiveConfirm: "Archive this collection and keep its contents and history.",
  unavailable: "Resource unavailable",
  unavailableNote:
    "Current access or a safe published version is missing. The reference can still be removed.",
  inCollection: "Already in collection",
  open: "Open resource",
  versions: "Version preferences",
  added: "Added",
  revision: "Revision",
  items: "Resources",
  ready: "Ready to download",
  search: "Search accessible resource names",
  apply: "Search",
  clear: "Clear",
  previous: "Previous",
  next: "Next",
  page: "Page",
  of: "of",
  json: "View private JSON",
  back: "Back to collection",
  limit:
    "Maximum 30 collections per account and 200 resources per collection. Archived collections count toward the limit.",
  signIn: "Sign in",
  signInRequired: "Sign in to manage your collections",
  notFound: "Collection is unavailable",
  loading: "Loading collections…",
  invalid: "Check the name and operation.",
  conflict: "The collection changed. Reload before starting another operation.",
  forbidden: "This collection or resource is unavailable to your account.",
  quota: "The collection limit has been reached.",
  retry:
    "The result could not be confirmed. Retry the same operation or reload to check the current state.",
  retryAction: "Retry same operation",
  frozen: "The submitted operation is fixed for safe retries.",
  reload: "Reload current state",
  saved: "Saved",
  busy: "Saving…",
  request: "Request",
  receipt: "Receipt",
  created: "Time (UTC)",
};
const ru: typeof en = {
  title: "Мои коллекции ресурсов",
  library: "Библиотека ресурсов",
  subtitle:
    "Группируйте полученные ресурсы. Коллекции доступны только вам и не предоставляют права на скачивание.",
  name: "Название коллекции",
  create: "Создать коллекцию",
  duplicate: "Скопировать коллекцию",
  copyNote:
    "Создайте отдельную активную коллекцию со всеми записями этой редакции, включая недоступные ресурсы. Выбор версий и права на скачивание действуют во всей библиотеке и при копировании не изменяются.",
  copyConfirm: "Подтверждаю редакцию источника и полный состав коллекции, указанный выше.",
  source: "Исходная коллекция",
  rename: "Переименовать",
  archive: "В архив",
  restore: "Восстановить",
  add: "Добавить в коллекцию",
  remove: "Убрать из коллекции",
  "add-many": "Добавить выбранные ресурсы",
  "remove-many": "Убрать выбранные записи",
  batchLimit: "Выберите до 20 ресурсов на этой странице. Операция применяется целиком.",
  batchConfirm: "Подтверждаю выбранные записи и действие.",
  selected: "Выбрано",
  candidates: "Добавить полученные ресурсы",
  history: "История изменений",
  active: "Активные",
  archived: "Архив",
  all: "Все",
  empty: "Здесь пока нет коллекций.",
  emptyItems: "Подходящих ресурсов нет.",
  archivedNote:
    "Коллекция в архиве. Восстановите её, чтобы изменить название или состав. Права на ресурсы и выбранные версии сохраняются.",
  archiveConfirm: "Отправить коллекцию в архив, сохранив состав и историю.",
  unavailable: "Ресурс недоступен",
  unavailableNote:
    "Нет действующего доступа или безопасной опубликованной версии. Запись можно убрать из коллекции.",
  inCollection: "Уже в коллекции",
  open: "Открыть ресурс",
  versions: "Выбор версии",
  added: "Добавлен",
  revision: "Редакция",
  items: "Ресурсы",
  ready: "Доступны для скачивания",
  search: "Поиск по названиям доступных ресурсов",
  apply: "Найти",
  clear: "Сбросить",
  previous: "Назад",
  next: "Далее",
  page: "Страница",
  of: "из",
  json: "Открыть приватный JSON",
  back: "Назад к коллекции",
  limit:
    "До 30 коллекций на аккаунт и 200 ресурсов в коллекции. Архивные коллекции учитываются в лимите.",
  signIn: "Войти",
  signInRequired: "Войдите для управления коллекциями",
  notFound: "Коллекция недоступна",
  loading: "Загружаем коллекции…",
  invalid: "Проверьте название и выбранное действие.",
  conflict: "Коллекция изменилась. Обновите страницу перед новой операцией.",
  forbidden: "Коллекция или ресурс недоступны вашему аккаунту.",
  quota: "Достигнут лимит коллекций или записей.",
  retry:
    "Результат не удалось подтвердить. Повторите ту же операцию или обновите страницу для проверки текущего состояния.",
  retryAction: "Повторить ту же операцию",
  frozen: "Отправленная операция зафиксирована для безопасного повтора.",
  reload: "Обновить состояние",
  saved: "Сохранено",
  busy: "Сохраняем…",
  request: "Запрос",
  receipt: "Квитанция",
  created: "Время (UTC)",
};
export function libraryCollectionsCopy(locale: "ru" | "en") {
  return locale === "ru" ? ru : en;
}
export function libraryCollectionError(locale: "ru" | "en", code: unknown) {
  const c = libraryCollectionsCopy(locale);
  if (code === "COLLECTION_INVALID" || code === "INVALID_JSON" || code === "BODY_TOO_LARGE")
    return c.invalid;
  if (
    code === "COLLECTION_CONFLICT" ||
    code === "COLLECTION_REQUEST_REUSED" ||
    code === "COLLECTION_ARCHIVED"
  )
    return c.conflict;
  if (
    code === "COLLECTION_LIMIT" ||
    code === "COLLECTION_ITEM_LIMIT" ||
    code === "COLLECTION_HISTORY_LIMIT"
  )
    return c.quota;
  if (code === "UNAUTHORIZED") return c.signInRequired;
  if (code === "NOT_FOUND" || code === "FORBIDDEN" || code === "COLLECTION_ACCESS_CHANGED")
    return c.forbidden;
  return c.retry;
}
