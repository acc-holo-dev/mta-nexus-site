import {
  serverActivityCursor,
  type ServerActivityAction,
  type ServerActivityField,
} from "@nexus/domain";
import type { Locale } from "./i18n";

export function serverActivityHref(serverId: string, cursor?: string | null): string {
  const path = `/workspace/servers/${encodeURIComponent(serverId)}/activity`;
  return cursor ? `${path}?before=${encodeURIComponent(cursor)}` : path;
}

const en = {
  title: "Server activity",
  open: "View activity",
  description:
    "Registration, listing edits and issued control challenges. Only recorded events are shown.",
  private: "This history is available to current server managers and platform administrators.",
  back: "Back to server management",
  empty: "No recorded activity yet.",
  end: "No earlier recorded activity. This page link may have expired.",
  latest: "Latest activity",
  older: "Earlier activity",
  navigation: "Activity pages",
  fields: "Saved fields",
  actor: "By",
  you: "You",
  unknownActor: "Account unavailable",
  system: "System",
  actions: {
    "server.created": "Server registered",
    "server.updated": "Listing updated",
    "server.claim_challenge_issued": "Control challenge issued",
  } satisfies Record<ServerActivityAction, string>,
  fieldNames: {
    name: "Name",
    description: "Description",
    websiteUrl: "Website",
    discordUrl: "Discord",
    rulesUrl: "Rules",
    mediaUrls: "Media",
    language: "Language",
    region: "Region",
    gameplayTags: "Gameplay tags",
    ipAddress: "Address",
    port: "Game port",
    httpPort: "HTTP port",
    gameMode: "Game mode",
    mapName: "Map",
    maxPlayers: "Player capacity",
    visibility: "Visibility",
  } satisfies Record<ServerActivityField, string>,
};

const ru: typeof en = {
  title: "История сервера",
  open: "Открыть историю",
  description:
    "Регистрация, правки карточки и выданные проверки контроля. Показаны только сохранённые события.",
  private: "Эта история доступна текущим управляющим сервера и администраторам платформы.",
  back: "Назад к управлению сервером",
  empty: "Сохранённых событий пока нет.",
  end: "Более ранних событий нет. Возможно, ссылка на эту страницу устарела.",
  latest: "Последние события",
  older: "Более ранние события",
  navigation: "Страницы истории",
  fields: "Поля правки",
  actor: "Автор",
  you: "Вы",
  unknownActor: "Аккаунт недоступен",
  system: "Система",
  actions: {
    "server.created": "Сервер зарегистрирован",
    "server.updated": "Карточка обновлена",
    "server.claim_challenge_issued": "Выдана проверка контроля",
  },
  fieldNames: {
    name: "Название",
    description: "Описание",
    websiteUrl: "Сайт",
    discordUrl: "Discord",
    rulesUrl: "Правила",
    mediaUrls: "Медиа",
    language: "Язык",
    region: "Регион",
    gameplayTags: "Теги игрового процесса",
    ipAddress: "Адрес",
    port: "Игровой порт",
    httpPort: "HTTP-порт",
    gameMode: "Игровой режим",
    mapName: "Карта",
    maxPlayers: "Вместимость",
    visibility: "Видимость",
  },
};

export function getServerActivityCopy(locale: Locale) {
  return locale === "ru" ? ru : en;
}

/** URL input cannot choose an arbitrary audit query or page size. */
export function parseServerActivityCursor(params: Record<string, string | string[] | undefined>) {
  return serverActivityCursor(params.before);
}
