/** Bounded, public release-history query parameters and bilingual copy. */
export function parseReleaseHistoryPage(input: string | string[] | undefined): number {
  if (typeof input !== "string" || !/^[1-9][0-9]{0,4}$/u.test(input)) {
    return 1;
  }
  return Number(input);
}

export function releaseHistoryHref(slug: string, page = 1): string {
  const base = `/market/${encodeURIComponent(slug)}/versions`;
  return page > 1 ? `${base}?page=${page}` : base;
}

export const releaseHistoryCopy = {
  en: {
    title: "Release history",
    back: "Back to resource",
    intro: "Published, safely scanned builds and their recorded integrity information.",
    noBuilds: "No released builds are currently available.",
    version: "Version",
    released: "Released",
    size: "Size",
    target: "MTA target",
    notDeclared: "Not specified",
    notes: "Release notes",
    noNotes: "No release notes provided.",
    scan: "Verified scan",
    scanner: "Scanner",
    checksum: "SHA-256",
    signed: "Signature recorded",
    unsigned: "No signature recorded",
    signIn: "Sign in to download",
    acquire: "Add this free resource to your library to download a build.",
    browse: "All versions",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    warning: "Published status and scanner metadata can change. Every download rechecks current permissions and build safety; a listed version is not a permanent access guarantee.",
  },
  ru: {
    title: "История версий",
    back: "Вернуться к ресурсу",
    intro: "Опубликованные сборки с безопасной проверкой и данными о целостности.",
    noBuilds: "Сейчас нет доступных опубликованных сборок.",
    version: "Версия",
    released: "Опубликована",
    size: "Размер",
    target: "Версия MTA",
    notDeclared: "Не указана",
    notes: "Изменения версии",
    noNotes: "Описание обновления отсутствует.",
    scan: "Проверенный скан",
    scanner: "Сканер",
    checksum: "SHA-256",
    signed: "Подпись зарегистрирована",
    unsigned: "Подпись не зарегистрирована",
    signIn: "Войти для скачивания",
    acquire: "Добавьте бесплатный ресурс в библиотеку для скачивания сборки.",
    browse: "Все версии",
    previous: "Назад",
    next: "Далее",
    page: "Страница",
    of: "из",
    warning: "Статус публикации и проверки может измениться. При каждом скачивании заново проверяются права и безопасность сборки; наличие версии в истории не гарантирует постоянный доступ.",
  },
} as const;

export function getReleaseHistoryCopy(locale: "en" | "ru") {
  return releaseHistoryCopy[locale];
}
