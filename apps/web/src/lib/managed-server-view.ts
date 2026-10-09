import type { ManagedServerFilters } from "@nexus/db";
import type { Locale } from "./i18n";

export function parseManagedServerQuery(query: Record<string, string | string[] | undefined>) {
  const filters: ManagedServerFilters = {};
  if (typeof query.q === "string") filters.query = query.q.trim().slice(0, 120);
  if (
    query.status === "active" ||
    query.status === "inactive" ||
    query.status === "maintenance" ||
    query.status === "suspended"
  )
    filters.status = query.status;
  if (
    query.visibility === "public" ||
    query.visibility === "unlisted" ||
    query.visibility === "private"
  )
    filters.visibility = query.visibility;
  if (query.verification === "verified" || query.verification === "unverified")
    filters.verification = query.verification;
  const page =
    typeof query.page === "string" && /^[1-9][0-9]{0,5}$/u.test(query.page)
      ? Number(query.page)
      : 1;
  return { filters, page };
}

export function managedServerHref(filters: ManagedServerFilters = {}, page = 1) {
  const query = new URLSearchParams();
  if (filters.query) query.set("q", filters.query);
  if (filters.status) query.set("status", filters.status);
  if (filters.visibility) query.set("visibility", filters.visibility);
  if (filters.verification) query.set("verification", filters.verification);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return `/workspace/servers${suffix ? `?${suffix}` : ""}`;
}

const copy = {
  en: {
    title: "Managed servers",
    subtitle: "Your personal servers and the servers of organizations you manage.",
    back: "Back to workspace",
    register: "Register server",
    signInRequired: "Sign in to manage your servers",
    signIn: "Sign in",
    search: "Name or IP address",
    apply: "Apply filters",
    reset: "Reset filters",
    all: "All",
    visibility: "Visibility",
    verification: "Ownership proof",
    listingStatus: "Listing status",
    public: "Public",
    unlisted: "Unlisted",
    private: "Private",
    verified: "Verified",
    unverified: "Unverified",
    active: "Active",
    inactive: "Inactive",
    maintenance: "Maintenance",
    suspended: "Suspended",
    personal: "Personal server",
    organization: "Organization server",
    manage: "Manage",
    view: "View server",
    live: "Observed status",
    online: "Online",
    offline: "Offline",
    unknown: "Unknown",
    players: "players",
    liveNote:
      "Live status comes from the official MTA directory. Listing status is shown separately; unavailable or stale observations remain unknown.",
    empty: "You have no servers to manage yet.",
    emptyFilter: "No servers match these filters.",
    showing: "Showing",
    of: "of",
    page: "Page",
    previous: "Previous",
    next: "Next",
    updated: "Updated",
    openAll: "All managed servers",
    preview: "Showing up to four recently updated servers.",
    previewPlayers: "On the displayed servers",
    previewOnline: "online in this preview",
  },
  ru: {
    title: "Управляемые серверы",
    subtitle: "Ваши личные серверы и серверы организаций, которыми вы управляете.",
    back: "Вернуться в кабинет",
    register: "Зарегистрировать сервер",
    signInRequired: "Войдите для управления серверами",
    signIn: "Войти",
    search: "Название или IP-адрес",
    apply: "Применить фильтры",
    reset: "Сбросить фильтры",
    all: "Все",
    visibility: "Видимость",
    verification: "Подтверждение владения",
    listingStatus: "Статус страницы",
    public: "Публичный",
    unlisted: "По ссылке",
    private: "Приватный",
    verified: "Подтверждён",
    unverified: "Не подтверждён",
    active: "Активна",
    inactive: "Неактивна",
    maintenance: "Обслуживание",
    suspended: "Приостановлена",
    personal: "Личный сервер",
    organization: "Сервер организации",
    manage: "Управлять",
    view: "Открыть сервер",
    live: "Наблюдаемый статус",
    online: "Онлайн",
    offline: "Офлайн",
    unknown: "Неизвестен",
    players: "игроков",
    liveNote:
      "Живой статус получен из официального каталога MTA. Статус страницы показан отдельно; недоступные или устаревшие наблюдения остаются неизвестными.",
    empty: "У вас пока нет серверов для управления.",
    emptyFilter: "Нет серверов с выбранными фильтрами.",
    showing: "Показано",
    of: "из",
    page: "Страница",
    previous: "Назад",
    next: "Вперёд",
    updated: "Обновлён",
    openAll: "Все управляемые серверы",
    preview: "Показаны до четырёх недавно обновлённых серверов.",
    previewPlayers: "На показанных серверах",
    previewOnline: "онлайн среди показанных",
  },
} as const;

export function getManagedServerCopy(locale: Locale) {
  return copy[locale];
}
