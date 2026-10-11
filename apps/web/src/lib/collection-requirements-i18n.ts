export function collectionRequirementsCopy(locale: string) {
  return locale === "ru"
    ? {
        title: "Готовность коллекции",
        back: "К коллекции",
        revision: "Ревизия",
        items: "Ресурсов в коллекции",
        roots: "Проверено исходных ресурсов",
        unavailable: "Недоступных ресурсов",
        empty: "Коллекция пуста. Добавьте ресурсы для проверки.",
        withheld:
          "Некоторые ресурсы больше не доступны для этой проверки. Их закрытые сведения скрыты. Проверьте доступ и публикацию в коллекции.",
        archived:
          "Коллекция в архиве. Отчёт проверяет сохранённый состав и текущую доступность ресурсов.",
        note: "Общие зависимости проверяются один раз. Отчёт учитывает выбранные версии из библиотеки. Добавление ресурса в коллекцию не выдаёт права доступа.",
      }
    : {
        title: "Collection readiness",
        back: "Back to collection",
        revision: "Revision",
        items: "Collection resources",
        roots: "Checked root resources",
        unavailable: "Unavailable resources",
        empty: "This collection is empty. Add resources to check it.",
        withheld:
          "Some resources are no longer available for this check. Their private details are hidden. Review access and publication in the collection.",
        archived:
          "This collection is archived. The report checks its retained members and current resource availability.",
        note: "Shared dependencies are checked once. The report uses your library's selected versions. Collection membership does not grant access.",
      };
}
