import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  developerRequired: "Developer access required",
  rate: "Too many resource inspections. Please try again shortly.",
  textPlainRequired: "Send meta.xml as text/plain",
  exceedsLimit: "meta.xml exceeds the inspection limit",
  inspectFailed: "Could not inspect meta.xml",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  developerRequired: "Требуется доступ разработчика",
  rate: "Слишком много проверок meta.xml. Попробуйте чуть позже.",
  textPlainRequired: "Отправьте meta.xml как text/plain",
  exceedsLimit: "meta.xml превышает лимит проверки",
  inspectFailed: "Не удалось проверить meta.xml",
};

export const resourceInspectMetaApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
