import { authorPublicationDeskError } from "./author-publication-desk-copy";
import type { Locale } from "./i18n";

const en = {
  title: "Server publication history",
  description:
    "Current server owners and delegated managers can review retained editorial activity for this server's publication.",
  history: "Publication history",
  restoreHelp:
    "Restore a current archive recorded by a server editor as a draft for renewed moderation. A moderator archive or a legacy archive without current proof stays protected.",
  restoreConfirm: "Restore this server publication as a draft for renewed moderation?",
  restoreDenied: "This archive has no current server-editor proof. It cannot be restored here.",
  restoredNotice: "The publication was restored as a server draft.",
  identity: "Editor",
  unavailable: "Publication history could not be loaded. Reload the server workspace.",
};
const ru: Record<keyof typeof en, string> = {
  title: "История публикации сервера",
  description:
    "Действующие владельцы сервера и делегированные управляющие могут проверить сохранённые действия редакции с публикацией сервера.",
  history: "История публикации",
  restoreHelp:
    "Текущий архив, записанный редакцией сервера, можно вернуть в черновики для повторной модерации. Архив модератора и старый архив без актуального подтверждения защищены.",
  restoreConfirm: "Вернуть публикацию сервера в черновики для повторной модерации?",
  restoreDenied:
    "У этого архива нет актуального подтверждения редакции сервера. Восстановление здесь недоступно.",
  restoredNotice: "Публикация возвращена в черновики сервера.",
  identity: "Редактор",
  unavailable: "Не удалось загрузить историю публикации. Загрузите кабинет сервера.",
};
export const serverPublicationHistoryCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function serverPublicationHistoryError(locale: Locale, code: unknown) {
  return code === "PUBLICATION_RESTORE_DENIED"
    ? serverPublicationHistoryCopy(locale).restoreDenied
    : authorPublicationDeskError(locale, code);
}
