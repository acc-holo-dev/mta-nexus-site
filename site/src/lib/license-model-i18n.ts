import type { LicenseModel } from "@nexus/domain";
import type { Locale } from "./i18n";

/** Catalog licenseModel values: scope/term only — not Open/Closed Source or DRM. */
export const LICENSE_MODEL_VALUES = [
  "single_server",
  "multiple_servers",
  "organization",
  "subscription",
  "unlimited",
] as const satisfies readonly LicenseModel[];

const LABELS = {
  en: {
    single_server: "One license, one server",
    multiple_servers: "Multiple servers",
    organization: "Organization-wide",
    subscription: "Subscription",
    unlimited: "Unlimited",
    unknown: "Unknown access model",
  },
  ru: {
    single_server: "Одна лицензия — один сервер",
    multiple_servers: "Несколько серверов",
    organization: "На организацию",
    subscription: "Подписка",
    unlimited: "Без ограничений",
    unknown: "Неизвестная модель доступа",
  },
} as const;

type LicenseModelLabelKey = keyof typeof LABELS.en;

function resolveLocale(locale: string): Locale {
  return locale === "ru" ? "ru" : "en";
}

/**
 * Visible RU/EN label for the existing licenseModel enum.
 * Unknown values use a neutral fallback that does not read as success or open-source.
 */
export function licenseModelLabel(locale: string, model: string): string {
  const labels = LABELS[resolveLocale(locale)];
  return labels[model as LicenseModelLabelKey] ?? labels.unknown;
}
