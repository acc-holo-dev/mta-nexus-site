export type OfflineDocumentLocale = "en" | "ru";

export type OfflineDocumentCopy = {
  brand: string;
  title: string;
  heading: string;
  body: string;
  retry: string;
};

export const offlineDocumentCopy = {
  en: {
    brand: "MTA NEXUS",
    title: "MTA NEXUS — offline",
    heading: "You are offline",
    body: "NEXUS never confirms purchases, publishing, moderation, or other state changes without a server connection.",
    retry: "Try again",
  },
  ru: {
    brand: "MTA NEXUS",
    title: "MTA NEXUS — нет сети",
    heading: "Нет подключения к сети",
    body: "NEXUS не подтверждает покупки, публикации, модерацию и другие изменения без соединения с сервером.",
    retry: "Повторить",
  },
} as const satisfies Record<OfflineDocumentLocale, OfflineDocumentCopy>;
