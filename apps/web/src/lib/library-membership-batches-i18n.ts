const en = {
  title: "Change multiple collections",
  note: "Review changes to one resource across up to 20 active collections. Every change commits together; a stale revision, lost add access, full collection or failed audit cancels the entire group. Existing history records each collection change.",
  confirm: "I confirm the reviewed additions and removals and all collection revisions.",
  apply: "Apply all membership changes",
  selected: "Changed collections",
  current: "Current membership",
  desired: "Keep this resource in the collection",
  cannotAdd: "Current access or collection capacity does not allow adding.",
  receipt: "Group receipt",
  success: "All reviewed collection changes are recorded.",
  noChanges: "Choose a different membership in at least one collection.",
  quota: "At most 20 changed collections per operation and 5000 group receipts per account.",
};
const ru: typeof en = {
  title: "Изменить несколько коллекций",
  note: "Проверьте изменения одного ресурса в 20 активных коллекциях. Все изменения применяются вместе; устаревшая редакция, потеря доступа для добавления, заполненная коллекция или ошибка записи аудита отменяют всю группу. История сохраняет изменение каждой коллекции.",
  confirm: "Подтверждаю выбранные добавления и удаления и редакции всех коллекций.",
  apply: "Применить все изменения состава",
  selected: "Изменяемых коллекций",
  current: "Текущий состав",
  desired: "Оставить этот ресурс в коллекции",
  cannotAdd: "Действующий доступ или вместимость коллекции не позволяют добавить ресурс.",
  receipt: "Квитанция группы",
  success: "Все выбранные изменения коллекций записаны.",
  noChanges: "Измените состав хотя бы одной коллекции.",
  quota: "До 20 изменяемых коллекций за операцию и 5000 групповых квитанций на аккаунт.",
};
export function libraryMembershipBatchesCopy(locale: "ru" | "en") {
  return locale === "ru" ? ru : en;
}
