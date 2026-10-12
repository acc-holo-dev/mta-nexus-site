const en = {
  title: "Compare my collections",
  note: "Compare resource references in two of your collections. Counts cover the full pair; search matches currently accessible names. Collection membership never grants downloads.",
  choose: "Choose another collection to compare.",
  destination: "Comparison destination",
  compare: "Compare",
  all: "All references",
  "source-only": "Only in source",
  "destination-only": "Only in destination",
  common: "In both collections",
  unavailable: "Unavailable resources",
  transfer: "Transfer operation",
  noSourceItems: "This page has no source references to transfer.",
  destinationReadOnly:
    "Restore the destination collection before changing it. A terminal revision cannot be changed.",
  referenceNote:
    "Copying and moving use only selected source references from this page. Existing destination entries keep their dates. Unavailable references remain transferable with hidden names.",
};
const ru: typeof en = {
  title: "Сравнить мои коллекции",
  note: "Сравните записи ресурсов двух своих коллекций. Счётчики относятся к полному составу; поиск учитывает названия доступных сейчас ресурсов. Коллекции не предоставляют права на скачивание.",
  choose: "Выберите другую коллекцию для сравнения.",
  destination: "Коллекция для сравнения",
  compare: "Сравнить",
  all: "Все записи",
  "source-only": "Только в источнике",
  "destination-only": "Только в назначении",
  common: "В обеих коллекциях",
  unavailable: "Недоступные ресурсы",
  transfer: "Действие с записями",
  noSourceItems: "На этой странице нет записей источника для копирования или переноса.",
  destinationReadOnly:
    "Восстановите коллекцию назначения перед изменением. Коллекцию с предельной редакцией изменить нельзя.",
  referenceNote:
    "Копирование и перенос используют только выбранные записи источника с этой страницы. Имеющиеся записи назначения сохраняют даты. Недоступные записи можно переносить со скрытыми названиями.",
};
export function libraryCollectionComparisonCopy(locale: "ru" | "en") {
  return locale === "ru" ? ru : en;
}
