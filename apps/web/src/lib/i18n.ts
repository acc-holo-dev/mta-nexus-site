export const supportedLocales = ["en", "ru"] as const;
export type Locale = (typeof supportedLocales)[number];

export function resolveLocale(value: string | null | undefined): Locale {
  return value === "ru" ? "ru" : "en";
}

const en = {
  meta: {
    title: "MTA NEXUS — Live Servers, Community & Free Resources",
    description:
      "Discover live Multi Theft Auto servers, community updates, and free resources during the MTA Nexus closed beta.",
  },
  nav: {
    ecosystem: "Ecosystem",
    workspace: "Workspace",
    liveServers: "Live Servers",
    explore: "Explore",
    freeResources: "Free Resources",
    community: "Community",
    updates: "Updates",
    creators: "Creators",
    overview: "Overview",
    publishResource: "Publish Resource",
    registerServer: "Register Server",
    saved: "Saved",
    notifications: "Notifications",
    settings: "Settings",
    admin: "Admin",
    home: "Home",
    collapse: "Collapse sidebar",
    expand: "Expand sidebar",
    search: "Search servers, resources, creators...",
    closedBeta: "Closed beta",
  },
  locale: {
    label: "Language",
    switchTo: "Русский",
  },
  footer: {
    summary:
      "Live MTA server activity, community updates, and free resources in one place. Paid commerce is not enabled during the closed beta.",
    discover: "Discover",
    contribute: "Contribute",
    liveServers: "Live servers",
    freeResources: "Free resources",
    communityUpdates: "Community updates",
    registerServer: "Register a server",
    publishResource: "Publish a resource",
    workspace: "Workspace",
    terms: "Terms",
    privacy: "Privacy",
    copyright: "Copyright",
    disclaimer:
      "Not affiliated with Rockstar Games, Take-Two Interactive, or Multi Theft Auto.",
  },
  home: {
    liveEcosystem: "Live MTA ecosystem",
    title: "What is happening in MTA right now?",
    description:
      "Find public MTA servers from the official directory, follow community updates, and add useful resources without a fake checkout flow.",
    exploreServers: "Explore MTA servers",
    browseResources: "Browse free resources",
    playersOnline: "Players online",
    publicServers: "Public servers",
    resourcesShown: "Free resources shown",
    officialDirectory: "from the official MTA directory",
    directoryUnavailable: "directory temporarily unavailable",
    latestSnapshot: "latest available snapshot",
    resourcesContext: "popular published resources loaded on this page",
    networkTitle: "MTA Network",
    networkDescription:
      "The most populated public servers from the official MTA master-list",
    openDirectory: "Open directory",
    players: "players",
    directoryPanelUnavailable:
      "The official MTA directory is temporarily unavailable.",
    resourcesTitle: "Free resources",
    resourcesDescription: "Community resources you can add without payment",
    viewAllResources: "View all free resources",
    noResources: "The first free resources are being prepared.",
    updatesTitle: "Community updates",
    updatesDescription:
      "News, guides, and development notes from the MTA ecosystem",
    allUpdates: "All updates",
    noUpdates: "No community updates have been published yet.",
  },
  errors: {
    title: "Something went wrong",
    message:
      "An unexpected error occurred while loading this page. Retry the request or return to the home page.",
    retry: "Try again",
    home: "Go home",
    notFoundTitle: "Page not found",
    notFoundMessage:
      "The page does not exist or may have moved. Open the resource library or return home.",
    resourceLibrary: "Resource library",
  },
};

const ru: typeof en = {
  meta: {
    title: "MTA NEXUS — Серверы, сообщество и бесплатные ресурсы",
    description:
      "Живые серверы Multi Theft Auto, обновления сообщества и бесплатные ресурсы в закрытой бете MTA Nexus.",
  },
  nav: {
    ecosystem: "Экосистема",
    workspace: "Рабочая зона",
    liveServers: "Серверы",
    explore: "Обзор",
    freeResources: "Ресурсы",
    community: "Сообщество",
    updates: "Обновления",
    creators: "Авторы",
    overview: "Обзор",
    publishResource: "Опубликовать ресурс",
    registerServer: "Добавить сервер",
    saved: "Сохранённое",
    notifications: "Уведомления",
    settings: "Настройки",
    admin: "Админ",
    home: "Главная",
    collapse: "Свернуть боковую панель",
    expand: "Развернуть боковую панель",
    search: "Поиск серверов, ресурсов и авторов...",
    closedBeta: "Закрытая бета",
  },
  locale: {
    label: "Язык",
    switchTo: "English",
  },
  footer: {
    summary:
      "Активность MTA-серверов, обновления сообщества и бесплатные ресурсы в одном месте. Платные операции в закрытой бете отключены.",
    discover: "Найти",
    contribute: "Добавить",
    liveServers: "Серверы",
    freeResources: "Бесплатные ресурсы",
    communityUpdates: "Обновления сообщества",
    registerServer: "Добавить сервер",
    publishResource: "Опубликовать ресурс",
    workspace: "Рабочая зона",
    terms: "Условия",
    privacy: "Конфиденциальность",
    copyright: "Авторские права",
    disclaimer:
      "MTA Nexus не связан с Rockstar Games, Take-Two Interactive или проектом Multi Theft Auto.",
  },
  home: {
    liveEcosystem: "Живая экосистема MTA",
    title: "Что происходит в MTA прямо сейчас?",
    description:
      "Находите публичные MTA-серверы из официального каталога, следите за обновлениями сообщества и добавляйте полезные ресурсы без фиктивной оплаты.",
    exploreServers: "Открыть серверы MTA",
    browseResources: "Смотреть бесплатные ресурсы",
    playersOnline: "Игроков онлайн",
    publicServers: "Публичных серверов",
    resourcesShown: "Ресурсов показано",
    officialDirectory: "по официальному каталогу MTA",
    directoryUnavailable: "каталог временно недоступен",
    latestSnapshot: "последний доступный снимок",
    resourcesContext: "популярные опубликованные ресурсы на этой странице",
    networkTitle: "Сеть MTA",
    networkDescription:
      "Самые населённые публичные серверы из официального master-list MTA",
    openDirectory: "Открыть каталог",
    players: "игроков",
    directoryPanelUnavailable: "Официальный каталог MTA временно недоступен.",
    resourcesTitle: "Бесплатные ресурсы",
    resourcesDescription: "Ресурсы сообщества, доступные без оплаты",
    viewAllResources: "Все бесплатные ресурсы",
    noResources: "Первые бесплатные ресурсы ещё готовятся.",
    updatesTitle: "Обновления сообщества",
    updatesDescription:
      "Новости, руководства и заметки разработчиков из экосистемы MTA",
    allUpdates: "Все обновления",
    noUpdates: "Обновления сообщества пока не опубликованы.",
  },
  errors: {
    title: "Что-то пошло не так",
    message:
      "При загрузке страницы произошла непредвиденная ошибка. Повторите запрос или вернитесь на главную.",
    retry: "Повторить",
    home: "На главную",
    notFoundTitle: "Страница не найдена",
    notFoundMessage:
      "Страница не существует или была перемещена. Откройте библиотеку ресурсов или вернитесь на главную.",
    resourceLibrary: "Библиотека ресурсов",
  },
};

export const dictionaries: Record<Locale, typeof en> = { en, ru };

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
