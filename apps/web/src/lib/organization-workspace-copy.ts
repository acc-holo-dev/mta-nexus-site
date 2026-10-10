import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";

const en = {
  leave: "Leave organization",
  leaveConfirm: "Leave this organization? Your team and delegated access will be revoked.",
  title: "My organizations",
  description: "Manage your organization profile, team and delegated server access.",
  create: "Create organization",
  empty: "You have no organizations yet.",
  search: "Search organizations",
  searchTeam: "Search team members",
  filter: "Search",
  previous: "Previous",
  next: "Next",
  page: "Page",
  name: "Organization name",
  slug: "Public address",
  slugHelp:
    "3–80 lowercase letters, numbers and hyphens. The address stays the same after creation.",
  descriptionLabel: "Description",
  logo: "Logo URL",
  website: "Website URL",
  profile: "Public profile",
  save: "Save profile",
  saving: "Saving…",
  saved: "Changes saved.",
  open: "Open workspace",
  publicView: "View public page",
  reload: "Reload current data",
  loading: "Loading organization…",
  unavailable: "Unable to load the organization. Please try again.",
  invalid: "Check the fields and URL format.",
  team: "Team",
  username: "Username",
  usernameHelp: "Enter the exact username of an existing Nexus account, without @.",
  add: "Add member",
  role: "Role",
  owner: "Owner",
  admin: "Administrator",
  developer: "Developer",
  member: "Member",
  serverAccess: "Delegated server management",
  accessHelp:
    "Owners and administrators already manage servers. This permission also lets other team roles manage the organization's servers.",
  roleHelp:
    "Administrators manage the public profile, resources, servers and regular team members. Only the owner can appoint or remove administrators. Commercial permissions already assigned to a member are preserved.",
  ownerHelp:
    "Only the owner can transfer ownership to a current team member, with explicit confirmation in the team workspace.",
  remove: "Remove member",
  removeConfirm:
    "Remove this member from the organization? Their organizational access will be revoked.",
  updateMember: "Save member",
  noMembers: "No members match this search.",
  readOnly: "You can view this team. Profile and team changes require an owner or administrator.",
  back: "All organizations",
  errorConflict: "The organization or team changed. Reload current data before saving again.",
  errorExists: "This account already belongs to the organization.",
  errorMember: "The account or team member was not found.",
  errorProtected: "You cannot change this member or assign this role.",
  errorSlug: "This public address is already in use.",
  added: "Member added.",
  removed: "Member removed.",
  updated: "Member updated.",
  createHelp:
    "The organization will be owned by your personal account. Verification is handled separately.",
};
const ru: Record<keyof typeof en, string> = {
  leave: "Покинуть организацию",
  leaveConfirm: "Покинуть организацию? Доступ команды и делегированные разрешения будут отозваны.",
  title: "Мои организации",
  description: "Управляйте профилем организации, командой и доступом к серверам.",
  create: "Создать организацию",
  empty: "У вас пока нет организаций.",
  search: "Поиск организаций",
  searchTeam: "Поиск участников",
  filter: "Найти",
  previous: "Назад",
  next: "Далее",
  page: "Страница",
  name: "Название организации",
  slug: "Публичный адрес",
  slugHelp: "3–80 строчных латинских букв, цифр и дефисов. После создания адрес не меняется.",
  descriptionLabel: "Описание",
  logo: "URL логотипа",
  website: "URL сайта",
  profile: "Публичный профиль",
  save: "Сохранить профиль",
  saving: "Сохранение…",
  saved: "Изменения сохранены.",
  open: "Открыть кабинет",
  publicView: "Публичная страница",
  reload: "Загрузить актуальные данные",
  loading: "Загрузка организации…",
  unavailable: "Не удалось загрузить организацию. Попробуйте ещё раз.",
  invalid: "Проверьте поля и формат URL.",
  team: "Команда",
  username: "Username",
  usernameHelp: "Точный username существующего аккаунта Nexus, без @.",
  add: "Добавить участника",
  role: "Роль",
  owner: "Владелец",
  admin: "Администратор",
  developer: "Разработчик",
  member: "Участник",
  serverAccess: "Делегированное управление серверами",
  accessHelp:
    "Владельцы и администраторы уже управляют серверами. Это разрешение даёт доступ к управлению серверами и другим ролям команды.",
  roleHelp:
    "Администраторы управляют публичным профилем, ресурсами, серверами и обычными участниками команды. Только владелец назначает и удаляет администраторов. Ранее выданные коммерческие разрешения участника сохраняются.",
  ownerHelp:
    "Только владелец может передать владение действующему участнику с отдельным подтверждением в кабинете команды.",
  remove: "Удалить участника",
  removeConfirm: "Удалить участника из организации? Его организационный доступ будет отозван.",
  updateMember: "Сохранить участника",
  noMembers: "По этому запросу участники не найдены.",
  readOnly:
    "Вы можете просматривать команду. Для изменения профиля и команды нужны права владельца или администратора.",
  back: "Все организации",
  errorConflict:
    "Организация или команда изменились. Загрузите актуальные данные перед повторным сохранением.",
  errorExists: "Этот аккаунт уже состоит в организации.",
  errorMember: "Аккаунт или участник команды не найден.",
  errorProtected: "Вы не можете изменить этого участника или назначить эту роль.",
  errorSlug: "Этот публичный адрес уже занят.",
  added: "Участник добавлен.",
  removed: "Участник удалён.",
  updated: "Данные участника сохранены.",
  createHelp:
    "Организация будет принадлежать вашему личному аккаунту. Верификация выполняется отдельно.",
};
export const getOrganizationCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function organizationError(locale: Locale, code: unknown) {
  const copy = getOrganizationCopy(locale);
  switch (code) {
    case "CONFLICT":
      return copy.errorConflict;
    case "MEMBER_EXISTS":
      return copy.errorExists;
    case "MEMBER_NOT_FOUND":
      return copy.errorMember;
    case "MEMBER_PROTECTED":
      return copy.errorProtected;
    case "SLUG_CONFLICT":
      return copy.errorSlug;
    default:
      return userPlatformError(locale, code);
  }
}
