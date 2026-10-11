import type { LicenseTermNotificationData } from "@nexus/domain";
const copy = {
  en: {
    filters: "License filters",
    search: "Resource or license",
    apply: "Apply filters",
    clear: "Clear",
    export: "Export displayed page (CSV)",
    status: "Status",
    binding: "Server binding",
    term: "Recorded term",
    sort: "Order",
    newest: "Newest first",
    expiresSoon: "Expiry first",
    unknown: "Unknown term",
    finite: "Finite term",
    all: "All",
    bound: "Bound",
    unbound: "Unbound",
    expiring: "Expires within three days",
    active: "Active",
    expired: "Expired",
    suspended: "Suspended",
    revoked: "Revoked",
    previous: "Previous",
    next: "Next",
    archiveNote:
      "Unknown historical terms are preserved. Notices and expiry processing do not issue or renew a license. Dates use UTC.",
    maintenance: "License term processing",
    maintenanceNote:
      "The license worker warns once within three days and records finite term expiry. Expiry clears the runtime credential; it preserves the original term and all purchase records. Commerce notification preferences apply. Unknown terms require investigation and are never automatically converted.",
    due: "Expiry awaiting processing",
    warnings: "Warnings awaiting processing",
    unknownTerms: "Active or suspended licenses with unknown terms",
    empty: "No finite terms awaiting processing.",
    worker:
      "Processing is performed by the license-worker service. This view is read-only; runtime and file access still check actual expiry independently.",
    expiredTitle: "License expired",
    expiringTitle: "License expires soon",
    expiredMessage:
      "The recorded license term ended. Runtime authorization and license-based file access have ended.",
    expiringMessage:
      "The recorded license term ends within three days. Automatic renewal is unavailable.",
    back: "License moderation",
    currentPage: "Current page",
  },
  ru: {
    filters: "Фильтры лицензий",
    search: "Ресурс или лицензия",
    apply: "Применить",
    clear: "Сбросить",
    export: "Экспорт показанной страницы (CSV)",
    status: "Состояние",
    binding: "Привязка сервера",
    term: "Учётный срок",
    sort: "Порядок",
    newest: "Сначала новые",
    expiresSoon: "Сначала истекающие",
    unknown: "Срок неизвестен",
    finite: "Ограниченный срок",
    all: "Все",
    bound: "Привязана",
    unbound: "Не привязана",
    expiring: "Истекает в течение трёх дней",
    active: "Активна",
    expired: "Истекла",
    suspended: "Приостановлена",
    revoked: "Отозвана",
    previous: "Назад",
    next: "Далее",
    archiveNote:
      "Неизвестные исторические сроки сохраняются. Уведомления и обработка истечения не выдают и не продлевают лицензию. Даты указаны в UTC.",
    maintenance: "Обработка сроков лицензий",
    maintenanceNote:
      "Worker предупреждает один раз за три дня и фиксирует истечение ограниченного срока. При истечении токен запуска аннулируется; исходный срок и история покупок сохраняются. Учитываются настройки коммерческих уведомлений. Неизвестные сроки требуют проверки и автоматически не преобразуются.",
    due: "Истечения ожидают обработки",
    warnings: "Предупреждения ожидают обработки",
    unknownTerms: "Активные и приостановленные лицензии с неизвестным сроком",
    empty: "Ограниченных сроков для обработки нет.",
    worker:
      "Обработку выполняет сервис license-worker. Этот экран доступен для просмотра; запуск и выдача файлов независимо проверяют фактический срок.",
    expiredTitle: "Срок лицензии истёк",
    expiringTitle: "Лицензия скоро истечёт",
    expiredMessage:
      "Учётный срок лицензии закончился. Разрешение запуска и доступ к файлам по этой лицензии завершены.",
    expiringMessage:
      "Учётный срок лицензии заканчивается в течение трёх дней. Автоматическое продление недоступно.",
    back: "Модерация лицензий",
    currentPage: "Текущая страница",
  },
};
export const getLicenseMaintenanceCopy = (locale: "ru" | "en") => copy[locale];
export function licenseTermNotification(value: unknown, locale: "ru" | "en") {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<LicenseTermNotificationData>;
  if (
    data.kind !== "license_term" ||
    (data.event !== "expiring" && data.event !== "expired") ||
    typeof data.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(data.expiresAt)) ||
    new Date(data.expiresAt).toISOString() !== data.expiresAt
  )
    return null;
  const text = copy[locale];
  return {
    title: data.event === "expired" ? text.expiredTitle : text.expiringTitle,
    message: `${data.event === "expired" ? text.expiredMessage : text.expiringMessage}\nUTC: ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(data.expiresAt))}`,
  };
}
