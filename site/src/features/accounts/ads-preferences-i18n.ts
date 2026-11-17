import type { Locale } from "../../lib/platform/i18n";

const en = {
  heading: "Advertising and placements",
  description:
    "This preference affects only prospective sponsored placements and never changes organic score, order, reviews, popularity or trust. No behavioral profiling.",
  rendererOn: "Public slot renderer enabled; the preference will be honored by the serve path.",
  rendererOff:
    "Public slot renderer is off (default). The preference is stored, but no sponsored placements are currently shown.",
  allow: "Allow sponsored placements: enabled now",
  deny: "Do not show sponsored placements",
  statusAllowed: "Allowed",
  statusDenied: "Opted out (default stays opted-out)",
};

const ru: typeof en = {
  heading: "Реклама и показ",
  description:
    "Настройка касается только гипотетических sponsored-показов и не меняет органический score, порядок, отзывы, популярность или доверие. Никакого поведенческого профилирования.",
  rendererOn: "Публичный рендер слота включён; предпочтение будет учитываться serve-путём.",
  rendererOff:
    "Публичный рендер слота выключен (по умолчанию). Предпочтение сохраняется, но видимых sponsored-показов пока нет.",
  allow: "Разрешить shown: включено сейчас",
  deny: "Не показывать sponsored-размещения",
  statusAllowed: "Разрешено",
  statusDenied: "Отказано (opt-out по умолчанию сохраняется)",
};

export const adsPreferencesCopy = (locale: Locale) => (locale === "ru" ? ru : en);
