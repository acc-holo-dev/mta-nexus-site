export type OfflineDocumentLocale = "en" | "ru";

export type OfflineDocumentCopy = {
  brand: string;
  title: string;
  heading: string;
  body: string;
  retry: string;
  /** Fallback body when a push payload omits `body`. */
  pushFallbackBody: string;
};

/**
 * Dark-theme token literals mirrored from `globals.css` `.dark` for the SW offline
 * document (service workers cannot read the document CSS variables).
 */
export const offlineDocumentTheme = {
  page: "#090a0f",
  text: "#f1f5f9",
  textSecondary: "#c3ccd8",
  border: "#232838",
  fontSans: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
  fontDisplay: '"Unbounded", ui-sans-serif, system-ui, sans-serif',
} as const;

export const offlineDocumentCopy = {
  en: {
    brand: "MTA NEXUS",
    title: "MTA NEXUS — offline",
    heading: "You are offline",
    body: "NEXUS never confirms purchases, publishing, moderation, or other state changes without a server connection.",
    retry: "Try again",
    pushFallbackBody: "You have a new notification.",
  },
  ru: {
    brand: "MTA NEXUS",
    title: "MTA NEXUS — нет сети",
    heading: "Нет подключения к сети",
    body: "NEXUS не подтверждает покупки, публикации, модерацию и другие изменения без соединения с сервером.",
    retry: "Повторить",
    pushFallbackBody: "У вас новое уведомление.",
  },
} as const satisfies Record<OfflineDocumentLocale, OfflineDocumentCopy>;
