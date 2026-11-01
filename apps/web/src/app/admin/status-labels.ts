import type { Locale } from "../../lib/i18n";

const ADMIN_STATUS_LABELS = {
  en: {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    open: "Open",
    under_review: "Under review",
    resolved: "Resolved",
    dismissed: "Dismissed",
    clean: "Clean",
    malicious: "Malicious",
    suspicious: "Suspicious",
    pending_scan: "Scan pending",
    scanning: "Scanning",
    error: "Scan error",
    quarantined: "Quarantined",
    published: "Published",
    unknown: "Unknown status",
  },
  ru: {
    pending: "Ожидает",
    approved: "Одобрено",
    rejected: "Отклонено",
    open: "Открыта",
    under_review: "На проверке",
    resolved: "Решена",
    dismissed: "Отклонена",
    clean: "Чистая",
    malicious: "Вредоносная",
    suspicious: "Подозрительная",
    pending_scan: "Ожидает проверки",
    scanning: "Сканируется",
    error: "Ошибка проверки",
    quarantined: "В карантине",
    published: "Опубликована",
    unknown: "Неизвестный статус",
  },
} as const;

type AdminStatusKey = keyof typeof ADMIN_STATUS_LABELS.en;

/** Visible RU/EN label for admin moderation/scan enums. Enum values stay unchanged. */
export function adminStatusLabel(locale: Locale, status: string): string {
  const labels = ADMIN_STATUS_LABELS[locale] ?? ADMIN_STATUS_LABELS.en;
  return labels[status as AdminStatusKey] ?? labels.unknown;
}

export function adminStatusTone(
  status: string,
): "active" | "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "approved":
    case "resolved":
    case "clean":
    case "published":
      return "success";
    case "rejected":
    case "malicious":
    case "quarantined":
    case "error":
      return "danger";
    case "dismissed":
      return "neutral";
    case "pending":
    case "open":
    case "under_review":
    case "suspicious":
    case "pending_scan":
    case "scanning":
      return "warning";
    default:
      return "neutral";
  }
}
