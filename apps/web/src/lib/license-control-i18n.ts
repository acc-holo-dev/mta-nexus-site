const copy = {
  en: {
    title: "Manage license",
    back: "Back to licenses",
    manage: "Manage license",
    moderation: "License moderation",
    adminBack: "Back to moderation",
    previous: "Previous",
    next: "Next",
    policy:
      "Manage an existing license without changing its original term. New paid licenses and renewals require confirmed payment integration.",
    bindingPolicy:
      "One license stays on one server. After an address change, confirm control again and refresh this binding; the old token is cleared. Changed ownership or organization cannot be moved into the saved binding.",
    tokenPolicy:
      "This bearer token checks the saved license binding over HTTPS. It does not prove the calling machine's identity or protect source code. Keep it on the server and send it only to this site's check API.",
    tokenTerm:
      "The token lasts at most 30 days and never beyond the license expiry. Rotation invalidates the previous token immediately.",
    term: "Original license expiry",
    binding: "Server binding",
    noBinding: "Not bound",
    serverUnavailable: "Server no longer available under your permissions",
    tokenState: "Runtime token",
    active: "Active",
    inactive: "Inactive",
    available: "Binding is currently eligible",
    changed: "Binding is unavailable or its endpoint/scope changed",
    actions: {
      bind: "Bind server",
      refresh_binding: "Reconfirm the same server",
      rotate_token: "Create / replace token",
      revoke_token: "Revoke token",
      revoke: "Revoke license",
      suspend: "Suspend license",
      restore: "Restore unchanged term",
    },
    action: "Action",
    server: "Verified server",
    choose: "Choose a server",
    noServers:
      "No eligible servers. Complete the server-control proof and moderator approval first.",
    reason: "Reason (visible to the license owner)",
    confirm: "I confirm this action and its consequences",
    submit: "Apply",
    pending: "Applying…",
    revokeNote:
      "License revocation is final. Other independently granted resource permissions remain separate.",
    tokenOnce:
      "Copy this token now. It is displayed once and hidden after one minute; the server stores only its hash.",
    hide: "Hide token",
    copy: "Copy token",
    copied: "Copied",
    expires: "Token expires",
    success: "The server confirmed the change.",
    refresh: "Refresh",
    history: "Recent license actions",
    noHistory: "No recorded actions.",
    fullHistory: "Complete license history",
    recoveryNote:
      "Reconfirm the displayed endpoint revision of the same verified server. This records missing historical ownership or a changed address, revokes the old token and preserves the license expiry.",
    staff: "Staff",
    owner: "License owner",
    system: "System",
    endpointRevision: "Endpoint revision",
    releaseCheck: "Check a specific release",
    release: "Resource version",
    probe: "Check this release",
    releaseLoading: "Loading eligible releases…",
    releaseEmpty: "No eligible releases. Refresh the binding and check resource availability.",
    releaseNote:
      "This HTTPS check matches your license, server and the recorded release hash. It does not inspect installed files, prove the calling machine or protect source code. The result lasts at most 60 seconds; expiry, revocation and failed checks must stop runtime authorization.",
    releaseSaved: "The server confirmed this exact release. Runtime authorization expires at",
    releaseFailed:
      "The release check could not be confirmed. Treat it as denied; reload current context before retrying.",
    requestBody: "Request JSON (contains no token)",
    leaseExpired: "The short runtime authorization has expired. Check again.",
    all: "All statuses",
    search: "Search license or resource",
    searchButton: "Search",
    empty: "No licenses found.",
    checkEndpoint:
      'Check API: POST /api/licenses/check; Authorization: Bearer <token>; JSON body: {"serverId":"bound server ID"}. Reject failed checks and recheck every 60 seconds.',
    errors: {
      LICENSE_CONFLICT: "The license changed. Reload and review its current state.",
      LICENSE_INACTIVE: "This action is unavailable in the current license state.",
      LICENSE_EXPIRED: "The original license term has ended.",
      LICENSE_FINITE_TERM_REQUIRED:
        "A recorded finite expiry is required to activate or restore this license.",
      LICENSE_SINGLE_SERVER_REQUIRED: "Only single-server licenses support this binding.",
      LICENSE_ALREADY_BOUND: "The license already has a fixed server binding.",
      LICENSE_NOT_BOUND: "Bind a verified server first.",
      LICENSE_BINDING_CURRENT:
        "This binding already has the current endpoint and ownership snapshot.",
      LICENSE_SERVER_UNAVAILABLE:
        "Server proof, permissions or resource availability no longer meet the requirements.",
      LICENSE_SERVER_CHANGED:
        "The bound server's endpoint or organization changed. The saved binding cannot be moved.",
      RATE_LIMIT_EXCEEDED: "Too many requests. Try again shortly.",
      UNAUTHORIZED: "Sign in again.",
      FORBIDDEN: "Permission denied.",
      NOT_FOUND: "The license is unavailable.",
      VALIDATION_FAILED: "Choose an action and provide a reason of 5–1000 characters.",
      fallback: "The change could not be confirmed. Refresh before trying again.",
    },
  },
  ru: {
    title: "Управление лицензией",
    back: "К списку лицензий",
    manage: "Управлять лицензией",
    moderation: "Модерация лицензий",
    adminBack: "К модерации",
    previous: "Назад",
    next: "Далее",
    policy:
      "Управление существующей лицензией не меняет её исходный срок. Новые платные лицензии и продление требуют интеграции подтверждённой оплаты.",
    bindingPolicy:
      "Одна лицензия остаётся на одном сервере. После смены адреса подтвердите контроль заново и обновите привязку; старый токен будет отозван. Смена владельца или организации не переносится в сохранённую привязку.",
    tokenPolicy:
      "Bearer-токен проверяет сохранённую привязку лицензии по HTTPS. Он не доказывает идентичность вызывающей машины и не защищает исходный код. Храните его на сервере и передавайте только API проверки этого сайта.",
    tokenTerm:
      "Токен действует максимум 30 дней и не дольше срока лицензии. Замена немедленно отключает предыдущий токен.",
    term: "Исходный срок лицензии",
    binding: "Привязка к серверу",
    noBinding: "Не привязана",
    serverUnavailable: "Сервер больше недоступен по вашим правам",
    tokenState: "Токен проверки",
    active: "Активен",
    inactive: "Неактивен",
    available: "Привязка сейчас соответствует требованиям",
    changed: "Привязка недоступна либо изменился адрес или организация",
    actions: {
      bind: "Привязать сервер",
      refresh_binding: "Повторно подтвердить тот же сервер",
      rotate_token: "Создать / заменить токен",
      revoke_token: "Отозвать токен",
      revoke: "Отозвать лицензию",
      suspend: "Приостановить лицензию",
      restore: "Восстановить исходный срок",
    },
    action: "Действие",
    server: "Подтверждённый сервер",
    choose: "Выберите сервер",
    noServers:
      "Подходящих серверов нет. Сначала пройдите проверку контроля сервера и одобрение модератора.",
    reason: "Причина (видна владельцу лицензии)",
    confirm: "Подтверждаю действие и его последствия",
    submit: "Применить",
    pending: "Применяем…",
    revokeNote:
      "Отзыв лицензии окончательный. Другие независимо выданные права на ресурс учитываются отдельно.",
    tokenOnce:
      "Скопируйте токен сейчас. Он показывается один раз и скрывается через минуту; сервер хранит только его хеш.",
    hide: "Скрыть токен",
    copy: "Скопировать токен",
    copied: "Скопировано",
    expires: "Токен истекает",
    success: "Сервер подтвердил изменение.",
    refresh: "Обновить",
    history: "Последние действия с лицензией",
    noHistory: "Действий пока нет.",
    fullHistory: "Полная история лицензии",
    recoveryNote:
      "Подтвердите показанную ревизию адреса того же проверенного сервера. Это сохраняет недостающие исторические данные владельца или новый адрес, отзывает старый токен и не меняет срок лицензии.",
    staff: "Сотрудник",
    owner: "Владелец лицензии",
    system: "Система",
    endpointRevision: "Ревизия адреса",
    releaseCheck: "Проверить конкретную версию",
    release: "Версия ресурса",
    probe: "Проверить версию",
    releaseLoading: "Загрузка подходящих версий…",
    releaseEmpty: "Подходящих версий нет. Обновите привязку и проверьте доступность ресурса.",
    releaseNote:
      "HTTPS-проверка сопоставляет лицензию, сервер и учётный хеш версии. Она не проверяет установленные файлы, вызывающую машину и не защищает исходный код. Результат действует максимум 60 секунд; истечение, отзыв и ошибки проверки должны останавливать разрешение запуска.",
    releaseSaved: "Сервер подтвердил эту версию. Разрешение запуска истекает",
    releaseFailed:
      "Не удалось подтвердить проверку версии. Считайте её отклонённой; загрузите актуальные данные перед повтором.",
    requestBody: "JSON запроса (без токена)",
    leaseExpired: "Короткое разрешение запуска истекло. Выполните проверку снова.",
    all: "Все состояния",
    search: "Поиск лицензии или ресурса",
    searchButton: "Найти",
    empty: "Лицензии не найдены.",
    checkEndpoint:
      'API проверки: POST /api/licenses/check; Authorization: Bearer <token>; JSON: {"serverId":"ID привязанного сервера"}. Отклоняйте неуспешные проверки и повторяйте их каждые 60 секунд.',
    errors: {
      LICENSE_CONFLICT: "Лицензия изменилась. Обновите страницу и проверьте текущее состояние.",
      LICENSE_INACTIVE: "Действие недоступно в текущем состоянии лицензии.",
      LICENSE_EXPIRED: "Исходный срок лицензии закончился.",
      LICENSE_FINITE_TERM_REQUIRED:
        "Для активации или восстановления нужен сохранённый конечный срок.",
      LICENSE_SINGLE_SERVER_REQUIRED: "Привязка доступна только для лицензии на один сервер.",
      LICENSE_ALREADY_BOUND: "У лицензии уже есть фиксированная привязка к серверу.",
      LICENSE_NOT_BOUND: "Сначала привяжите подтверждённый сервер.",
      LICENSE_BINDING_CURRENT:
        "В привязке уже сохранены текущая ревизия адреса и данные владельца.",
      LICENSE_SERVER_UNAVAILABLE:
        "Доказательство контроля, права или доступность ресурса больше не соответствуют требованиям.",
      LICENSE_SERVER_CHANGED:
        "У привязанного сервера изменился адрес или организация. Перенос сохранённой привязки недоступен.",
      RATE_LIMIT_EXCEEDED: "Слишком много запросов. Повторите немного позже.",
      UNAUTHORIZED: "Войдите в аккаунт снова.",
      FORBIDDEN: "Недостаточно прав.",
      NOT_FOUND: "Лицензия недоступна.",
      VALIDATION_FAILED: "Выберите действие и укажите причину длиной 5–1000 символов.",
      fallback: "Не удалось подтвердить изменение. Обновите страницу перед повторной попыткой.",
    },
  },
} as const;
export const getLicenseControlCopy = (locale: "ru" | "en") => copy[locale];
export function licenseActionLabel(locale: "ru" | "en", action: string) {
  const actions: Readonly<Record<string, keyof typeof copy.en.actions>> = {
    "license.bound": "bind",
    "license.binding_refreshed": "refresh_binding",
    "license.token_rotated": "rotate_token",
    "license.token_revoked": "revoke_token",
    "license.revoked": "revoke",
    "license.suspended": "suspend",
    "license.restored": "restore",
  };
  const key = actions[action];
  return key ? copy[locale].actions[key] : copy[locale].history;
}
export function licenseControlError(locale: "ru" | "en", code: unknown) {
  const errors = copy[locale].errors;
  return typeof code === "string" && Object.hasOwn(errors, code)
    ? errors[code as keyof typeof errors]
    : errors.fallback;
}
