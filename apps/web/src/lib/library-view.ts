import type { UserLibraryFilter } from "@nexus/db";

/** Untrusted URL parameters never determine SQL columns or page limits. */
export function parseLibraryFilter(value: string | string[] | undefined): UserLibraryFilter {
  return value === "ready" || value === "unavailable" ? value : "all";
}

export function parseLibraryPage(value: string | string[] | undefined): number {
  return typeof value === "string" && /^[1-9][0-9]{0,5}$/u.test(value) ? Number(value) : 1;
}

export const libraryCopy = {
  en: {
    title: "Resource library",
    subtitle: "Resources granted to your account, including legacy licenses.",
    signInRequired: "Sign in to view your resource library",
    signIn: "Sign in",
    back: "Back to workspace",
    browse: "Browse free resources",
    all: "All",
    ready: "Available",
    unavailable: "Unavailable",
    showing: "Showing",
    of: "of",
    empty: "Your resource library is empty.",
    emptyFilter: "There are no resources matching this filter.",
    unavailableResource: "Resource temporarily unavailable",
    unavailableReason:
      "This resource is unpublished or has no approved, safely scanned build. Downloads are disabled until availability is restored.",
    availableReason: "Access is rechecked whenever a download starts.",
    added: "Added",
    open: "Open resource",
    page: "Page",
    previous: "Previous",
    next: "Next",
    note: "Your library reflects active grants only. Expired or revoked licenses do not grant access. This is not a record of purchases or payments.",
  },
  ru: {
    title: "Библиотека ресурсов",
    subtitle: "Ресурсы, доступные вашему аккаунту, включая ранее выданные лицензии.",
    signInRequired: "Войдите, чтобы посмотреть библиотеку ресурсов",
    signIn: "Войти",
    back: "Вернуться в кабинет",
    browse: "Каталог бесплатных ресурсов",
    all: "Все",
    ready: "Доступны",
    unavailable: "Недоступны",
    showing: "Показано",
    of: "из",
    empty: "В вашей библиотеке пока нет ресурсов.",
    emptyFilter: "Нет ресурсов с выбранным статусом.",
    unavailableResource: "Ресурс временно недоступен",
    unavailableReason:
      "Ресурс не опубликован либо не имеет одобренной, безопасно проверенной сборки. Скачивание недоступно до восстановления публикации.",
    availableReason: "Права доступа проверяются заново перед каждым скачиванием.",
    added: "Добавлен",
    open: "Открыть ресурс",
    page: "Страница",
    previous: "Назад",
    next: "Вперёд",
    note: "Библиотека показывает только действующие права. Истёкшие или отозванные лицензии не дают доступа. Это не история покупок или платежей.",
  },
} as const;

export function getLibraryCopy(locale: "en" | "ru") {
  return libraryCopy[locale];
}

export function libraryHref(filter: UserLibraryFilter, page: number) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/workspace/library${query ? "?" + query : ""}`;
}
