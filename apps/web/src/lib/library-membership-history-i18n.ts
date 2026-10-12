const en = {
  title: "Collection membership history",
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
  empty: "No matching membership operations.",
  history: "Membership history",
};
const ru: typeof en = {
  title: "История состава коллекций",
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
  empty: "Подходящих операций с составом коллекций нет.",
  history: "История состава",
};
export function libraryMembershipHistoryCopy(locale: "ru" | "en") {
  return locale === "ru" ? ru : en;
}
