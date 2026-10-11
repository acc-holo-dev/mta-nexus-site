import { authorPublicationDeskError } from "./author-publication-desk-copy";
import type { Locale } from "./i18n";

const en = {
  title: "Organization publication history",
  description:
    "Current owners and administrators can review retained editorial activity for this organization's publication.",
  history: "Publication history",
  restoreHelp:
    "Restore only an archive recorded by this organization's editors for the current saved version. Restoration creates a draft for renewed review. Moderator archives and legacy archives without current proof stay protected.",
  restoreConfirm:
    "Restore this team-archived publication as a draft? It will require renewed review before publication.",
  restoreDenied:
    "This archive has no current organization-editor proof. It cannot be restored here.",
  restoredNotice: "The publication was restored as an organization draft.",
  identity: "Team member",
  unavailable: "Publication history could not be loaded. Reload the organization workspace.",
};
const ru: Record<keyof typeof en, string> = {
  title: "История публикации организации",
  description:
    "Действующие владельцы и администраторы могут проверить сохранённые действия редакции с публикацией своей организации.",
  history: "История публикации",
  restoreHelp:
    "Восстановить можно только архив, записанный редакцией организации для текущей версии. Материал возвращается в черновики для повторной проверки. Архив модератора и старый архив без актуального подтверждения защищены.",
  restoreConfirm:
    "Вернуть архивную публикацию команды в черновики? Перед публикацией потребуется повторная проверка.",
  restoreDenied:
    "У этого архива нет актуального подтверждения редакции организации. Восстановление здесь недоступно.",
  restoredNotice: "Публикация возвращена в черновики организации.",
  identity: "Участник команды",
  unavailable: "Не удалось загрузить историю публикации. Загрузите кабинет организации.",
};
export const organizationPublicationHistoryCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function organizationPublicationHistoryError(locale: Locale, code: unknown) {
  return code === "PUBLICATION_RESTORE_DENIED"
    ? organizationPublicationHistoryCopy(locale).restoreDenied
    : authorPublicationDeskError(locale, code);
}
