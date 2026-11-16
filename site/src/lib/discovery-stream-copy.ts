import type { Locale } from "./i18n";
import { discoveryCopy } from "./discovery-copy";
const en = {
  title: "Browse the growing directory",
  description:
    "Registered public servers, creators and organizations, newest first. Continue through the directory without a numbered-page limit.",
  latest: "Latest results",
  older: "Older results",
  newer: "Newer results",
  paged: "Numbered and alphabetical directory",
  loading: "Loading the directory…",
  invalid:
    "These filters or continuation belong to another directory. Reload the latest matching results.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Навигация по растущему каталогу",
  description:
    "Зарегистрированные публичные серверы, разработчики и организации — сначала новые. Просматривайте каталог без ограничения количества страниц.",
  latest: "Новые результаты",
  older: "Более старые",
  newer: "Более новые",
  paged: "Каталог по страницам и алфавиту",
  loading: "Загрузка каталога…",
  invalid:
    "Фильтры или продолжение относятся к другому каталогу. Загрузите новые результаты с нужными фильтрами.",
};
export const discoveryStreamCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export const discoveryStreamError = (locale: Locale, code: unknown) =>
  code === "INVALID_CURSOR" || code === "VALIDATION_ERROR"
    ? discoveryStreamCopy(locale).invalid
    : code === "RATE_LIMIT_EXCEEDED"
      ? discoveryCopy(locale).rate
      : discoveryCopy(locale).unavailable;
