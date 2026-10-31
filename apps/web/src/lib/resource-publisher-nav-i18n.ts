import type { Locale } from "./i18n";

const copy = {
  en: {
    navigation: "Resource publisher sections",
    overview: "Overview",
    groupCard: "Resource card",
    groupVersions: "Versions and review",
    groupCommerce: "Commerce",
    media: "Gallery",
    variants: "Variants",
    compatibility: "Compatibility",
    duplicate: "Duplicate resource",
    copyHistory: "Copy history",
    activity: "Activity",
    moderation: "Moderation history",
    changes: "Resource changes",
    sales: "Sales report",
    deliveries: "Deliveries",
  },
  ru: {
    navigation: "Разделы кабинета ресурса",
    overview: "Обзор",
    groupCard: "Карточка ресурса",
    groupVersions: "Версии и проверка",
    groupCommerce: "Коммерция",
    media: "Галерея",
    variants: "Варианты",
    compatibility: "Совместимость",
    duplicate: "Дублировать ресурс",
    copyHistory: "История копий",
    activity: "Активность",
    moderation: "История модерации",
    changes: "Изменения ресурса",
    sales: "Отчёт о продажах",
    deliveries: "Выдачи",
  },
} as const;

export function getResourcePublisherNavCopy(locale: Locale) {
  return copy[locale];
}

export type ResourcePublisherNavCopy = ReturnType<typeof getResourcePublisherNavCopy>;
