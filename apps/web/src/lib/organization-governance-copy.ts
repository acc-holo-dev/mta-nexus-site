import type { Locale } from "./i18n";
import { organizationError } from "./organization-workspace-copy";
import { privateChangeHistoryError } from "./private-change-history-copy";

const en = {
  transfer: "Transfer ownership",
  description: "Only the current owner can transfer this organization to an existing team member.",
  consequence:
    "The selected member will own the organization and control its team, resources and servers. Your chosen team role and previously assigned permissions will remain.",
  select: "Select a current team member",
  selected: "New owner",
  choose: "Select for ownership transfer",
  formerRole: "Your role after transfer",
  confirmation: "Type the organization's public address to confirm",
  confirmHelp: "Enter exactly",
  currentPassword: "Current password",
  currentPasswordHelp: "Confirm with your account password. A live session alone is not enough.",
  submit: "Confirm ownership transfer",
  confirm: "Transfer full organization ownership to this selected member?",
  transferred: "Ownership transferred. Your team role has been updated.",
  noSelection:
    "Choose a member from the team list below. Search and pagination can find other current members.",
  cancel: "Cancel selection",
  invalid: "Check the selected member, public address, password and profile version.",
  reauthRequired: "Current password is incorrect. Re-enter it and try again.",
  targetInvalid: "The selected account is no longer an eligible team member. Reload the team.",
  ownerRequired: "Only the current organization owner can perform this action.",
  unavailable: "Unable to load organization activity. Try again.",
  mutationUnavailable:
    "The saved result could not be confirmed. Reload the organization before trying again.",
  refreshFailed: "The change was saved, but the team could not be refreshed. Reload current data.",
  history: "Organization activity",
  historyDescription: "Profile, team access and ownership changes recorded by Nexus.",
  privacy:
    "Only current owners and administrators can view this history. Private contacts and verification evidence are not shown.",
  empty: "No recorded changes yet.",
  latest: "Latest activity",
  older: "Earlier activity",
  expired:
    "This history link has expired or does not belong to this organization. Open the latest activity.",
  by: "By",
  subject: "Affected account",
  unavailableAccount: "Account unavailable",
  fields: "Saved fields",
  role: "Team role",
  serverAccess: "Delegated server access",
  enabled: "Enabled",
  disabled: "Disabled",
  back: "Back to organization",
  reload: "Reload saved state",
  actions: {
    "organization.created": "Organization created",
    "organization.profile_updated": "Public profile updated",
    "organization.member_added": "Member added",
    "organization.member_updated": "Team role or delegated access updated",
    "organization.member_removed": "Member removed",
    "organization.member_left": "Member left",
    "organization.ownership_transferred": "Ownership transferred",
  },
  fieldNames: { name: "Name", description: "Description", logoUrl: "Logo", websiteUrl: "Website" },
};
const ru: typeof en = {
  transfer: "Передать владение",
  description: "Только текущий владелец может передать организацию действующему участнику команды.",
  consequence:
    "Выбранный участник станет владельцем организации и получит управление командой, ресурсами и серверами. У вас останутся выбранная роль команды и ранее выданные разрешения.",
  select: "Выберите действующего участника",
  selected: "Новый владелец",
  choose: "Выбрать для передачи владения",
  formerRole: "Ваша роль после передачи",
  confirmation: "Введите публичный адрес организации для подтверждения",
  confirmHelp: "Введите точно",
  currentPassword: "Текущий пароль",
  currentPasswordHelp: "Подтвердите паролем аккаунта. Одной активной сессии недостаточно.",
  submit: "Подтвердить передачу владения",
  confirm: "Передать полное владение организацией выбранному участнику?",
  transferred: "Владение передано. Ваша роль в команде обновлена.",
  noSelection:
    "Выберите участника в списке команды ниже. Используйте поиск и страницы для остальных участников.",
  cancel: "Отменить выбор",
  invalid: "Проверьте выбранного участника, публичный адрес, пароль и версию профиля.",
  reauthRequired: "Неверный текущий пароль. Введите его снова и повторите попытку.",
  targetInvalid: "Выбранный аккаунт больше не подходит для передачи. Загрузите актуальную команду.",
  ownerRequired: "Это действие доступно только текущему владельцу организации.",
  unavailable: "Не удалось загрузить историю организации. Попробуйте ещё раз.",
  mutationUnavailable:
    "Сохранённый результат не удалось подтвердить. Загрузите организацию перед повторным действием.",
  refreshFailed: "Изменение сохранено, но команда не обновилась. Загрузите актуальные данные.",
  history: "История организации",
  historyDescription: "Изменения профиля, командного доступа и владельца, сохранённые Nexus.",
  privacy:
    "История доступна только текущему владельцу и администраторам. Приватные контакты и доказательства верификации не показаны.",
  empty: "Сохранённых изменений пока нет.",
  latest: "Последние события",
  older: "Более ранние события",
  expired:
    "Ссылка истории устарела или относится к другой организации. Откройте последние события.",
  by: "Автор",
  subject: "Затронутый аккаунт",
  unavailableAccount: "Аккаунт недоступен",
  fields: "Сохранённые поля",
  role: "Роль в команде",
  serverAccess: "Делегированное управление серверами",
  enabled: "Выдано",
  disabled: "Отключено",
  back: "К организации",
  reload: "Загрузить сохранённое состояние",
  actions: {
    "organization.created": "Организация создана",
    "organization.profile_updated": "Публичный профиль изменён",
    "organization.member_added": "Участник добавлен",
    "organization.member_updated": "Роль или делегированный доступ изменены",
    "organization.member_removed": "Участник удалён",
    "organization.member_left": "Участник вышел",
    "organization.ownership_transferred": "Владение передано",
  },
  fieldNames: { name: "Название", description: "Описание", logoUrl: "Логотип", websiteUrl: "Сайт" },
};
export const organizationGovernanceCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function organizationGovernanceError(locale: Locale, code: unknown) {
  const copy = organizationGovernanceCopy(locale);
  if (code === "OWNERSHIP_OWNER_REQUIRED") return copy.ownerRequired;
  if (code === "OWNERSHIP_TARGET_INVALID") return copy.targetInvalid;
  if (code === "FRESH_AUTH_REQUIRED") return copy.reauthRequired;
  if (code === "ORGANIZATION_HISTORY_EXPIRED") return copy.expired;
  if (["CHANGE_HISTORY_FILTER_INVALID", "INVALID_CURSOR"].includes(String(code)))
    return privateChangeHistoryError(locale, code);
  if (
    [
      "VALIDATION_ERROR",
      "OWNERSHIP_CONFIRMATION_REQUIRED",
      "UNSUPPORTED_MEDIA_TYPE",
      "REQUEST_BODY_TOO_LARGE",
    ].includes(String(code))
  )
    return copy.invalid;
  if (["INTERNAL_ERROR", "UNCONFIRMED"].includes(String(code))) return copy.unavailable;
  return organizationError(locale, code);
}
export const organizationGovernanceMutationError = (locale: Locale, code: unknown) =>
  ["INTERNAL_ERROR", "UNCONFIRMED"].includes(String(code))
    ? organizationGovernanceCopy(locale).mutationUnavailable
    : organizationGovernanceError(locale, code);
