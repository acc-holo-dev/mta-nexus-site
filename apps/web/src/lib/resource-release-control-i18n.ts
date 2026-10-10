const copy = {
  en: {
    updates: "Library versions and updates",
    versions: "Choose a download version",
    moderation: "Resource moderation",
    moderationHistory: "Publication restrictions",
    all: "All resources",
    pinned: "Fixed version",
    unavailable: "Unavailable",
    latest: "Latest approved version",
    update_available: "Another approved release is available",
    selection_unavailable: "Your selected release is unavailable",
    choose: "Use this version",
    useLatest: "Use latest approved version",
    selected: "Selected version",
    selectNote:
      "This preference selects a download version. It does not confirm installation, create access, extend a license or change its server binding. Downloads always recheck current access and malware-scan evidence.",
    latestNote:
      "Latest mode follows the newest approved, clean publication. Fixed mode keeps your selected release until you change it. A withdrawn release is never silently replaced.",
    selectSaved: "Download preference confirmed.",
    saving: "Saving…",
    empty: "No resources match this filter.",
    noVersions: "No approved version is currently available.",
    privateResource: "Resource unavailable",
    back: "Back",
    library: "Library",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    reason: "Reason visible to the publisher",
    suspend: "Suspend resource",
    release: "Return to draft",
    history: "Decision history",
    search: "Search by title",
    status: "Status",
    allStates: "All states",
    draft: "Draft",
    pending_review: "Pending review",
    published: "Published",
    suspended: "Suspended",
    archived: "Archived",
    unknown: "Unknown state",
    moderationNote:
      "Suspension stops public discovery, acquisition and file delivery. Releasing a restriction returns the resource and its published/pending versions to draft for review. Quarantined files remain quarantined. Existing access rights and payments are preserved.",
    publisherNote:
      "Only a current moderator can release this restriction. Release returns the resource to draft; submit a clean version for review before publication.",
    confirmSuspend: "I confirm that this resource must be removed from public availability.",
    confirmRelease: "I confirm return to draft for a new review.",
    saved: "Moderation decision confirmed.",
    open: "Open resource",
    manage: "Manage versions",
    revision: "Preference revision",
    releaseNotes: "Release notes",
    publication: "Release date (UTC)",
    signIn: "Sign in",
    signInRequired: "Sign in to manage your library",
    legacySuspend: "Suspension (historical record)",
    legacyRestore: "Restore (historical record)",
    errors: {
      RESOURCE_CONTROL_INVALID: "Check the selected release and request details.",
      RESOURCE_MODERATION_INVALID: "Provide a reason, confirmation and current resource revision.",
      LIBRARY_RELEASE_CONFLICT: "Your preference changed. Reload before selecting a version.",
      LIBRARY_RELEASE_UNAVAILABLE: "This release is withdrawn or no longer cleared for delivery.",
      PRODUCT_METADATA_CONFLICT: "The resource changed. Reload before continuing.",
      PRODUCT_STATE_CHANGED: "This action is unavailable in the current resource state.",
      NOT_FOUND: "The resource or your current access is unavailable.",
      FORBIDDEN: "Your current permissions do not allow this action.",
      RATE_LIMIT_EXCEEDED: "Too many requests. Try again shortly.",
      fallback: "The result could not be confirmed. Reload the current state before retrying.",
    },
  },
  ru: {
    updates: "Версии и обновления библиотеки",
    versions: "Выбор версии для скачивания",
    moderation: "Модерация ресурсов",
    moderationHistory: "Ограничения публикации",
    all: "Все ресурсы",
    pinned: "Выбранная версия",
    unavailable: "Недоступен",
    latest: "Последняя одобренная версия",
    update_available: "Доступен другой одобренный выпуск",
    selection_unavailable: "Выбранный выпуск недоступен",
    choose: "Выбрать эту версию",
    useLatest: "Использовать последнюю одобренную",
    selected: "Выбранная версия",
    selectNote:
      "Настройка выбирает версию для скачивания. Она не подтверждает установку, не выдаёт доступ, не продлевает лицензию и не меняет привязку к серверу. При скачивании повторно проверяются доступ и результаты проверки файла.",
    latestNote:
      "Режим последней версии использует самый новый одобренный чистый выпуск. Фиксированный режим сохраняет выбранный выпуск до вашего изменения. Недоступный выпуск не заменяется автоматически.",
    selectSaved: "Версия для скачивания подтверждена.",
    saving: "Сохранение…",
    empty: "Нет ресурсов по этому фильтру.",
    noVersions: "Одобренных доступных версий сейчас нет.",
    privateResource: "Ресурс недоступен",
    back: "Назад",
    library: "Библиотека",
    previous: "Назад",
    next: "Далее",
    page: "Страница",
    of: "из",
    reason: "Причина, видимая издателю",
    suspend: "Приостановить ресурс",
    release: "Вернуть в черновик",
    history: "История решений",
    search: "Поиск по названию",
    status: "Состояние",
    allStates: "Все состояния",
    draft: "Черновик",
    pending_review: "На проверке",
    published: "Опубликован",
    suspended: "Приостановлен",
    archived: "В архиве",
    unknown: "Неизвестное состояние",
    moderationNote:
      "Приостановка отключает публичное отображение, получение ресурса и выдачу файлов. Снятие ограничения возвращает ресурс и опубликованные/ожидающие версии в черновик для проверки. Файлы в карантине остаются в карантине. Права доступа и платежи сохраняются.",
    publisherNote:
      "Снять ограничение может только действующий модератор. После снятия ресурс возвращается в черновик: отправьте чистую версию на проверку перед публикацией.",
    confirmSuspend: "Подтверждаю, что ресурс нужно снять с публичного доступа.",
    confirmRelease: "Подтверждаю возврат в черновик для повторной проверки.",
    saved: "Решение модерации подтверждено.",
    open: "Открыть ресурс",
    manage: "Управлять версиями",
    revision: "Версия настройки",
    releaseNotes: "Описание выпуска",
    publication: "Дата выпуска (UTC)",
    signIn: "Войти",
    signInRequired: "Войдите для управления библиотекой",
    legacySuspend: "Приостановка (историческая запись)",
    legacyRestore: "Восстановление (историческая запись)",
    errors: {
      RESOURCE_CONTROL_INVALID: "Проверьте выбранный выпуск и параметры запроса.",
      RESOURCE_MODERATION_INVALID: "Укажите причину, подтверждение и актуальную версию ресурса.",
      LIBRARY_RELEASE_CONFLICT: "Настройка изменилась. Обновите страницу перед выбором версии.",
      LIBRARY_RELEASE_UNAVAILABLE: "Выпуск снят с публикации или больше не разрешён к выдаче.",
      PRODUCT_METADATA_CONFLICT: "Ресурс изменился. Обновите страницу перед продолжением.",
      PRODUCT_STATE_CHANGED: "Действие недоступно в текущем состоянии ресурса.",
      NOT_FOUND: "Ресурс или ваш действующий доступ недоступен.",
      FORBIDDEN: "Ваши действующие права не разрешают это действие.",
      RATE_LIMIT_EXCEEDED: "Слишком много запросов. Попробуйте немного позже.",
      fallback: "Результат не удалось подтвердить. Обновите состояние перед повтором.",
    },
  },
} as const;
export function getResourceReleaseControlCopy(locale: string) {
  return locale === "ru" ? copy.ru : copy.en;
}
export function resourceStatusLabel(locale: string, status: string) {
  const localized = getResourceReleaseControlCopy(locale);
  const known = (["draft", "pending_review", "published", "suspended", "archived"] as const).find(
    (value) => value === status,
  );
  return known ? localized[known] : localized.unknown;
}
export function resourceReleaseControlError(locale: string, code: unknown) {
  const errors = getResourceReleaseControlCopy(locale).errors;
  return typeof code === "string" && Object.hasOwn(errors, code)
    ? errors[code as keyof typeof errors]
    : errors.fallback;
}
export function resourceModerationLabel(locale: string, action: string) {
  const copy = getResourceReleaseControlCopy(locale);
  return action === "product.moderation_suspended"
    ? copy.suspend
    : action === "product.moderation_released"
      ? copy.release
      : action === "admin.suspend"
        ? copy.legacySuspend
        : copy.legacyRestore;
}
