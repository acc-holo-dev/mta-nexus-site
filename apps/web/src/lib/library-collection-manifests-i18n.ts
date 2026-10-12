const en = {
  title: "Import resource references",
  export: "Export collection JSON",
  choose: "Choose a collection JSON file",
  paste: "Or paste collection JSON",
  preview: "Review import",
  busy: "Reading…",
  invalid: "Use a valid collection JSON file no larger than 64 KiB.",
  note: "Export stores the collection snapshot and up to 200 resource IDs. Import adds selected references to this collection; current account access is checked again when saving. Existing entries keep their dates. Review at most 20 additions at once within the available space.",
  empty: "The file contains no resource references.",
  present: "Already included",
  blocked: "Cannot add with current access or collection state",
  eligible: "Can be added",
  capacity: "Free reference slots",
  frozen:
    "This import attempt is fixed. Retry the same submitted selection, or reload to review another file.",
  result: "Import preview",
  current: "Current destination",
  retained: "Existing entries and contents are preserved.",
};
const ru: typeof en = {
  title: "Импорт ссылок на ресурсы",
  export: "Экспорт коллекции JSON",
  choose: "Выберите JSON-файл коллекции",
  paste: "Или вставьте JSON коллекции",
  preview: "Проверить импорт",
  busy: "Чтение…",
  invalid: "Нужен корректный JSON-файл коллекции размером не более 64 КиБ.",
  note: "Экспорт хранит снимок коллекции и до 200 ID ресурсов. Импорт добавляет выбранные ссылки в эту коллекцию; при сохранении доступ аккаунта проверяется повторно. Даты существующих записей сохраняются. За один раз можно проверить до 20 добавлений в пределах свободного места.",
  empty: "В файле нет ссылок на ресурсы.",
  present: "Уже включён",
  blocked: "Добавление недоступно при текущем доступе или состоянии коллекции",
  eligible: "Можно добавить",
  capacity: "Свободных мест для ссылок",
  frozen:
    "Попытка импорта зафиксирована. Повторите ту же отправленную выборку или обновите страницу для проверки другого файла.",
  result: "Предпросмотр импорта",
  current: "Текущее назначение",
  retained: "Существующие записи и состав сохраняются.",
};
export function libraryCollectionManifestsCopy(locale: "ru" | "en") {
  return locale === "ru" ? ru : en;
}
