const en = {
  title: "Collection command history",
  note: "Inspect your recorded collection changes. Filters match whole operations; collection IDs match destinations and recorded copy/move sources. Resource filters match explicitly recorded IDs, so full collection copies are excluded. Labels describe current access; receipts describe the recorded result.",
  days: "Days",
  action: "Operation",
  collectionId: "Collection ID",
  productId: "Resource ID",
  filter: "Apply filters",
  clear: "Clear filters",
  export: "Download this JSON page",
  empty: "No matching collection operations.",
  unknown: "The recorded operation could not be verified.",
  current: "Current collection",
  recorded: "Recorded collection",
  sourceCurrent: "Current source collection",
  unavailable: "Current resource unavailable",
  fullCopy:
    "Full copy receipt stores a count and digest; individual resource IDs are not recorded.",
  noCurrent: "Current collection unavailable",
  time: "Time (UTC)",
};
const ru: typeof en = {
  title: "История команд коллекций",
  note: "Ваши записанные изменения коллекций. Фильтры выбирают операции целиком; ID коллекции совпадает с назначением или записанным источником копирования/переноса. Фильтр ресурса ищет явно записанные ID, поэтому полные копии коллекций не включаются. Названия отражают текущий доступ, квитанции — записанный результат.",
  days: "Дней",
  action: "Операция",
  collectionId: "ID коллекции",
  productId: "ID ресурса",
  filter: "Применить фильтры",
  clear: "Сбросить фильтры",
  export: "Скачать эту страницу JSON",
  empty: "Подходящих операций с коллекциями нет.",
  unknown: "Записанную операцию не удалось проверить.",
  current: "Текущая коллекция",
  recorded: "Записанная коллекция",
  sourceCurrent: "Текущая исходная коллекция",
  unavailable: "Ресурс сейчас недоступен",
  fullCopy:
    "Квитанция полной копии хранит количество и хэш состава; отдельные ID ресурсов не записаны.",
  noCurrent: "Текущая коллекция недоступна",
  time: "Время (UTC)",
};
export function libraryCollectionHistoryCopy(locale: "ru" | "en") {
  return locale === "ru" ? ru : en;
}
