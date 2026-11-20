export type GlobalErrorLocale = "en" | "ru";

const copy = {
  en: {
    title: "MTA NEXUS could not start",
    message:
      "A critical interface error prevented the application shell from loading. Retry the page or return to the home page.",
    retry: "Try again",
    home: "Home",
    referenceLabel: "Support reference",
    referenceHint: "Include this code when contacting support.",
    copyReference: "Copy reference",
    copied: "Copied",
    copyUnavailable: "Select and copy the code manually",
  },
  ru: {
    title: "Не удалось запустить MTA NEXUS",
    message:
      "Критическая ошибка интерфейса помешала загрузить оболочку приложения. Повторите попытку или вернитесь на главную страницу.",
    retry: "Повторить",
    home: "На главную",
    referenceLabel: "Код для поддержки",
    referenceHint: "Укажите этот код при обращении в поддержку.",
    copyReference: "Скопировать код",
    copied: "Скопировано",
    copyUnavailable: "Выделите и скопируйте код вручную",
  },
} as const;

export function detectGlobalErrorLocale(cookie: string): GlobalErrorLocale {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === "nexus_locale=ru")
    ? "ru"
    : "en";
}

export function globalErrorCopy(locale: GlobalErrorLocale) {
  return copy[locale];
}
