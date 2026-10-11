import type { Locale } from "./i18n";

const en = {
  title: "Bulk team changes",
  help: "Select up to 20 members on this page. Review the server's current access changes before confirming. All changes are saved together.",
  select: "Select member",
  all: "Select eligible members on this page",
  clear: "Clear selection",
  selected: "Selected members",
  action: "Action",
  role: "Change team role",
  access: "Change delegated server access",
  remove: "Remove from organization",
  enabled: "Enable",
  disabled: "Disable",
  preview: "Review changes",
  reviewing: "Preparing review…",
  review: "Server review",
  before: "Current",
  after: "After saving",
  unchanged: "Already matches",
  effective: "Effective server access",
  removed: "Removed",
  confirm: "Save reviewed changes",
  saving: "Saving…",
  cancel: "Cancel review",
  warning:
    "Removing members revokes their organization access. Role and delegated access changes preserve other existing permission grants.",
  confirmRemove:
    "Remove all changed members shown in this review? Their organization access will be revoked.",
  saved: "Reviewed team changes saved.",
  noChanges: "The selected members already have the requested access.",
  uncertain:
    "The review or saved result could not be confirmed. Reload the team before trying again.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Массовое управление командой",
  help: "Выберите до 20 участников на этой странице. Перед подтверждением проверьте актуальные изменения доступа, рассчитанные сервером. Все изменения сохраняются вместе.",
  select: "Выбрать участника",
  all: "Выбрать доступных участников на странице",
  clear: "Снять выбор",
  selected: "Выбрано участников",
  action: "Действие",
  role: "Изменить роль команды",
  access: "Изменить делегированный доступ к серверам",
  remove: "Удалить из организации",
  enabled: "Включить",
  disabled: "Отключить",
  preview: "Проверить изменения",
  reviewing: "Подготовка проверки…",
  review: "Проверка сервером",
  before: "Сейчас",
  after: "После сохранения",
  unchanged: "Уже соответствует",
  effective: "Фактический доступ к серверам",
  removed: "Удалён",
  confirm: "Сохранить проверенные изменения",
  saving: "Сохранение…",
  cancel: "Отменить проверку",
  warning:
    "Удаление участников отзывает их доступ к организации. Изменения роли и делегированного доступа сохраняют остальные ранее выданные разрешения.",
  confirmRemove:
    "Удалить всех изменяемых участников из этой проверки? Их доступ к организации будет отозван.",
  saved: "Проверенные изменения команды сохранены.",
  noChanges: "У выбранных участников уже установлен нужный доступ.",
  uncertain:
    "Не удалось подтвердить проверку или сохранённый результат. Загрузите команду перед повторным действием.",
};
export const organizationBatchCopy = (locale: Locale) => (locale === "ru" ? ru : en);
