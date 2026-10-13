const en = {
  title: "Collection receipt",
  open: "Open receipt",
  restore: "Restore selected recorded changes",
  note: "The receipt records the committed result. Restoration offers an inverse of its recorded additions/removals under your current collection state and resource access. Choose changes explicitly; later edits to other references are retained.",
  unsupported: "This receipt does not prove a reversible composition change.",
  unknown: "The recorded receipt could not be verified.",
  recorded: "Recorded collection",
  current: "Current collection",
  time: "Time (UTC)",
  ready: "Ready to restore",
  already: "Already in the restored state",
  noAccess: "Current access is required to restore this reference",
  readOnly: "The collection cannot currently be changed",
  currentMember: "Current membership",
  expected: "Recorded result",
  restoreAction: "Restoration action",
  export: "Download private receipt JSON",
};
const ru: typeof en = {
  title: "Квитанция коллекции",
  open: "Открыть квитанцию",
  restore: "Восстановить выбранные изменения",
  note: "Квитанция хранит записанный результат. Восстановление предлагает обратные добавления и удаления с учётом текущего состава коллекции и доступа к ресурсам. Выберите изменения явно; последующие правки других ссылок сохранятся.",
  unsupported: "Эта квитанция не подтверждает обратимое изменение состава.",
  unknown: "Записанную квитанцию не удалось проверить.",
  recorded: "Записанная коллекция",
  current: "Текущая коллекция",
  time: "Время (UTC)",
  ready: "Готово к восстановлению",
  already: "Уже в восстановленном состоянии",
  noAccess: "Для восстановления этой ссылки нужен действующий доступ",
  readOnly: "Коллекцию сейчас нельзя изменять",
  currentMember: "Текущее вхождение",
  expected: "Записанный результат",
  restoreAction: "Действие восстановления",
  export: "Скачать приватную квитанцию JSON",
};
export function libraryCollectionReceiptsCopy(locale: "ru" | "en") {
  return locale === "ru" ? ru : en;
}
export const collectionReceiptHref = (id: string) =>
  `/workspace/library/collections/receipts/${encodeURIComponent(id)}`;
