const en = {
  loadUnavailable:
    "Collection membership history is temporarily unavailable. Please try again.",
  title: "Collection membership history",
  loading: "Loading membership history…",
  note: "Inspect whole resource membership operations. Recorded names, revisions and changes remain unchanged; current collection membership and resource access are shown separately. Filters select whole groups, including every recorded collection.",
  detail: "Group receipt",
  additions: "Additions only",
  removals: "Removals only",
  mixed: "Mixed changes",
  all: "All operations",
  before: "Reviewed membership",
  after: "Recorded membership",
  present: "Included",
  absent: "Not included",
  currentMembership: "Current membership",
  emptyNever: "You have no recorded collection membership operations yet.",
  emptyFiltered: "No matching membership operations.",
  clear: "Clear filters",
  history: "Membership history",
};
const ru: typeof en = {
  loadUnavailable: "История состава коллекций временно недоступна. Попробуйте ещё раз.",
  title: "История состава коллекций",
  loading: "Загрузка истории состава…",
  note: "Операции с одним ресурсом показаны целиком. Записанные названия, ревизии и изменения сохраняются; текущий состав коллекций и доступ к ресурсу показаны отдельно. Фильтры выбирают группы со всеми записанными коллекциями.",
  detail: "Общая квитанция",
  additions: "Только добавления",
  removals: "Только удаления",
  mixed: "Смешанные изменения",
  all: "Все операции",
  before: "Проверенное вхождение",
  after: "Записанное вхождение",
  present: "Включён",
  absent: "Не включён",
  currentMembership: "Текущее вхождение",
  emptyNever: "Записанных операций с составом коллекций пока нет.",
  emptyFiltered: "Подходящих операций с составом коллекций нет.",
  clear: "Сбросить фильтры",
  history: "История состава",
};
export function libraryMembershipHistoryCopy(locale: "ru" | "en") {
  return locale === "ru" ? ru : en;
}
