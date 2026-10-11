const en = {
  title: "Collection release overview",
  note: "Compare your selected releases with the latest safe published builds. Counts follow the name search; fixed selections also appear in the pinned filter. This snapshot does not change versions or grant access. Downloads recheck current rights.",
  archived:
    "This archived collection can be inspected. Restore it before using version batch controls.",
  export: "Export this page as JSON",
  generated: "Snapshot time (UTC)",
};
const ru: typeof en = {
  title: "Обзор выпусков коллекции",
  note: "Сравните выбранные версии с последними безопасными опубликованными сборками. Счётчики учитывают поиск по названию; закреплённые версии также входят в фильтр закреплений. Обзор не меняет версии и права. При скачивании доступ проверяется заново.",
  archived:
    "Архивную коллекцию можно просматривать. Восстановите её перед групповым выбором версий.",
  export: "Экспортировать эту страницу в JSON",
  generated: "Время снимка (UTC)",
};
export function collectionReleasesCopy(locale: string) {
  return locale === "ru" ? ru : en;
}
