import type { Locale } from "../../lib/i18n";

const en = {
  title: "Placement lifecycle",
  description: "Slots, capacity and active placements (feature-flag, no public exposure)",
  emptyTitle: "No ad slots yet",
  emptyDescription: "Register ad slots through the placement repository as an admin operator.",
  loadUnavailable: "Placement inventory is temporarily unavailable.",
  loadUnavailableHint: "Retry to reload ad slots. An empty inventory is not a load failure.",
  positionCapacity: (positionKey: string, capacity: number) =>
    `Position ${positionKey} · capacity ${capacity}`,
  pending: (count: number) => `Pending: ${count}`,
  active: (count: number) => `Active: ${count}`,
  enabledTotal: (count: number) => `Enabled slots total: ${count}`,
  rendererOn: "Public slot renderer enabled",
  rendererOff: "Public slot renderer is off (default)",
};

const ru: typeof en = {
  title: "Размещение (lifecycle)",
  description: "Слоты, ёмкость и активные размещения (feature-flag, без публичной выдачи)",
  emptyTitle: "Слоты ещё не созданы",
  emptyDescription: "Зарегистрируйте админ-оператором слоты через репозиторий размещений.",
  loadUnavailable: "Инвентарь размещений временно недоступен.",
  loadUnavailableHint:
    "Повторите попытку, чтобы загрузить слоты. Пустой инвентарь — это не сбой загрузки.",
  positionCapacity: (positionKey, capacity) => `Позиция ${positionKey} · ёмкость ${capacity}`,
  pending: (count) => `В ожидании: ${count}`,
  active: (count) => `Активно: ${count}`,
  enabledTotal: (count) => `Итого включено слотов: ${count}`,
  rendererOn: "Публичный слот-рендер включён",
  rendererOff: "Публичный слот-рендер выключен (по умолчанию)",
};

export const adminAdPlacementCopy = (locale: Locale) => (locale === "ru" ? ru : en);
