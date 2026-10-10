const copy = {
  en: {
    variants: "Resource variants",
    compatibility: "Compatibility and dependencies",
    back: "Back to resource",
    variantNote:
      "Link up to 12 resources from the same publisher. Each variant has separate versions, moderation and access rights. Adding one to the library does not grant the others. Only published, scanned variants appear in the marketplace when the anchor resource is published.",
    anchorNote: "Manage this group from its anchor resource.",
    manageAnchor: "Manage variant group",
    title: "Group title",
    label: "Variant label",
    base: "Base",
    reason: "Reason for this change",
    selected: "Selected variants",
    candidates: "Resources from this publisher",
    noCandidates: "No eligible resources on this page.",
    add: "Add",
    remove: "Remove",
    up: "Move up",
    down: "Move down",
    save: "Save changes",
    dissolve: "Remove variant group",
    dissolveNote:
      "This removes the links. Resource files, publications and licenses remain intact.",
    confirm: "I confirm removal of the variant links.",
    previous: "Previous",
    next: "Next",
    page: "Page",
    working: "Saving…",
    saved: "Changes saved.",
    mta: "Minimum MTA version",
    dependencies: "Dependency resource slugs",
    dependencyHint:
      "One slug per line, up to 25. Missing or private dependencies remain unresolved; this setting never grants access to their files.",
    compatibilityNote:
      "This describes the resource's requirements. It does not change the target version recorded for existing builds.",
    browse: "Choose a variant",
    version: "Version",
    independent: "Each variant is added to your library separately.",
    errors: {
      RESOURCE_VARIANTS_INVALID: "Check the title, labels, selected resources and reason.",
      RESOURCE_VARIANTS_ANCHOR_MISSING: "The anchor resource must remain in its group.",
      RESOURCE_VARIANTS_CONFLICT:
        "The group changed or a resource belongs to another group. Reload before saving.",
      RESOURCE_COMPATIBILITY_INVALID: "Use a valid MTA version and up to 25 unique resource slugs.",
      RESOURCE_DEPENDENCY_SELF: "A resource cannot depend on itself.",
      PRODUCT_METADATA_CONFLICT: "The resource changed. Reload before saving.",
      PRODUCT_STATE_CHANGED: "The current resource state does not allow this change.",
      NOT_FOUND: "The resource is unavailable or you no longer have access.",
      UNAUTHORIZED: "Sign in again.",
      RATE_LIMIT_EXCEEDED: "Too many requests. Try again later.",
      fallback: "Could not confirm the operation. Reload and try again.",
    },
  },
  ru: {
    variants: "Варианты ресурса",
    compatibility: "Совместимость и зависимости",
    back: "Назад к ресурсу",
    variantNote:
      "Свяжите до 12 ресурсов одного издателя. У каждого варианта отдельные версии, модерация и права доступа. Добавление одного варианта в библиотеку не даёт доступ к остальным. В Marketplace отображаются только опубликованные проверенные варианты, когда основной ресурс группы опубликован.",
    anchorNote: "Управляйте группой со страницы её основного ресурса.",
    manageAnchor: "Управлять группой вариантов",
    title: "Название группы",
    label: "Название варианта",
    base: "Основной",
    reason: "Причина изменения",
    selected: "Выбранные варианты",
    candidates: "Ресурсы этого издателя",
    noCandidates: "На этой странице нет доступных ресурсов.",
    add: "Добавить",
    remove: "Убрать",
    up: "Переместить выше",
    down: "Переместить ниже",
    save: "Сохранить изменения",
    dissolve: "Удалить группу вариантов",
    dissolveNote: "Будут удалены только связи. Файлы, публикации и лицензии ресурсов сохранятся.",
    confirm: "Подтверждаю удаление связей между вариантами.",
    previous: "Назад",
    next: "Далее",
    page: "Страница",
    working: "Сохранение…",
    saved: "Изменения сохранены.",
    mta: "Минимальная версия MTA",
    dependencies: "Slug зависимых ресурсов",
    dependencyHint:
      "Один slug на строку, не более 25. Недоступные и приватные зависимости остаются неразрешёнными; эта настройка не предоставляет доступ к их файлам.",
    compatibilityNote:
      "Это требования ресурса. Настройка не меняет целевую версию, записанную для существующих сборок.",
    browse: "Выберите вариант",
    version: "Версия",
    independent: "Каждый вариант добавляется в библиотеку отдельно.",
    errors: {
      RESOURCE_VARIANTS_INVALID:
        "Проверьте название группы, варианты, выбранные ресурсы и причину.",
      RESOURCE_VARIANTS_ANCHOR_MISSING: "Основной ресурс должен остаться в группе.",
      RESOURCE_VARIANTS_CONFLICT:
        "Группа изменилась или ресурс входит в другую группу. Обновите страницу перед сохранением.",
      RESOURCE_COMPATIBILITY_INVALID:
        "Укажите корректную версию MTA и до 25 уникальных slug ресурсов.",
      RESOURCE_DEPENDENCY_SELF: "Ресурс не может зависеть от самого себя.",
      PRODUCT_METADATA_CONFLICT: "Ресурс изменился. Обновите страницу перед сохранением.",
      PRODUCT_STATE_CHANGED: "Текущее состояние ресурса не позволяет выполнить изменение.",
      NOT_FOUND: "Ресурс недоступен или права доступа отозваны.",
      UNAUTHORIZED: "Войдите снова.",
      RATE_LIMIT_EXCEEDED: "Слишком много запросов. Повторите позже.",
      fallback: "Не удалось подтвердить операцию. Обновите страницу и повторите.",
    },
  },
} as const;
export const getResourceManagementCopy = (locale: "ru" | "en") => copy[locale];
export function resourceManagementError(locale: "ru" | "en", code: unknown) {
  const errors = copy[locale].errors;
  return typeof code === "string" && Object.hasOwn(errors, code)
    ? errors[code as keyof typeof errors]
    : errors.fallback;
}
