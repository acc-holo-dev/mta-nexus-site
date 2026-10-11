import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";

const en = {
  title: "Verification centre",
  description:
    "Apply for identity, developer experience or organization verification and track review decisions.",
  identity: "Verified identity",
  experience: "Verified developer experience",
  organization: "Organization",
  server: "Server control",
  user: "Identity",
  developer: "Developer experience",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  history: "Decisions",
  current: "Current profile status",
  verified: "Verified",
  unverified: "Not verified",
  apply: "Apply for verification",
  profile: "Professional profile",
  profileDescription: "Show your skills and public contacts on your developer profile.",
  specialties: "Specialties (one per line, up to 12)",
  github: "GitHub or portfolio URL",
  discord: "Discord contact",
  save: "Save profile",
  saved: "Profile saved.",
  invalidation:
    "Changing specialties or the portfolio URL removes developer experience verification. Identity verification remains separate.",
  pendingChange:
    "If your profile changes during review, open your pending application and update its evidence to submit the current profile.",
  proof: "Evidence URL",
  notes: "Explain your experience or authority",
  proofPrivacy:
    "Evidence and explanations are visible only to you and moderators. Do not publish private credentials.",
  submit: "Submit application",
  submitted: "Application saved and awaiting review.",
  target: "Verification target",
  choose: "Choose organization",
  manage: "Organizations you manage",
  noTeams: "No organizations you manage match this search.",
  requiresProfile:
    "Save at least one specialty in your professional profile before applying for experience verification.",
  teamPending: "This organization already has a pending application.",
  alreadyPending: "An application for this target is already pending.",
  alreadyVerified: "This target is already verified.",
  serverHint: "Server control is verified through an MTA control challenge, not an evidence URL.",
  servers: "Manage MTA servers",
  editProfile: "Edit professional profile",
  publicProfile: "View public profile",
  signIn: "Sign in to manage verification",
  unavailable: "Unable to load verification information. Try again.",
  mutationUnavailable:
    "The result could not be confirmed. Reload your saved profile or applications before trying again.",
  invalid: "Check the profile fields, explanation and evidence URL.",
  changed: "The profile changed. Reload before saving again.",
  authorityChanged: "Your current role or organization rights do not allow this application.",
  profileChanged:
    "The professional profile changed after submission. The applicant must update the evidence before approval.",
  selfReview: "Another moderator must approve your application.",
  reviewNotes: "Moderator feedback",
  noApplications: "No applications in this view.",
  all: "All targets",
  type: "Verification type",
  search: "Search",
  query: "Search organizations",
  previous: "Previous page",
  next: "Next page",
  page: "Page",
  reload: "Reload saved state",
  loading: "Loading…",
  back: "Back to verification",
  cancel: "Cancel",
  roleRequired: "A current developer or administrator role is required to edit this profile.",
  submittedAt: "Submitted",
  decidedAt: "Decided",
  identityHint: "Identity verification does not certify skills or resource quality.",
  decisionUnavailable:
    "The decision could not be confirmed. Reload the moderation queue before trying again.",
  stateChanged: "This application has already changed. Reload the moderation queue.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Центр верификации",
  description:
    "Подайте заявку на подтверждение личности, опыта разработчика или организации и следите за решением.",
  identity: "Личность подтверждена",
  experience: "Опыт разработчика подтверждён",
  organization: "Организация",
  server: "Контроль сервера",
  user: "Личность",
  developer: "Опыт разработчика",
  pending: "Рассматривается",
  approved: "Одобрена",
  rejected: "Отклонена",
  history: "Решения",
  current: "Текущий статус профиля",
  verified: "Подтверждено",
  unverified: "Не подтверждено",
  apply: "Подать заявку",
  profile: "Профессиональный профиль",
  profileDescription: "Покажите свои специализации и публичные контакты в профиле разработчика.",
  specialties: "Специализации (по одной на строку, до 12)",
  github: "Ссылка на GitHub или портфолио",
  discord: "Контакт Discord",
  save: "Сохранить профиль",
  saved: "Профиль сохранён.",
  invalidation:
    "Изменение специализаций или ссылки на портфолио снимает подтверждение опыта. Подтверждение личности учитывается отдельно.",
  pendingChange:
    "Если профиль изменится во время рассмотрения, откройте ожидающую заявку и обновите доказательства, чтобы отправить текущий профиль.",
  proof: "Ссылка на доказательства",
  notes: "Опишите опыт или полномочия",
  proofPrivacy:
    "Доказательства и пояснения видны только вам и модераторам. Не публикуйте секретные данные доступа.",
  submit: "Отправить заявку",
  submitted: "Заявка сохранена и ожидает рассмотрения.",
  target: "Цель верификации",
  choose: "Выбрать организацию",
  manage: "Организации под вашим управлением",
  noTeams: "Организаций под вашим управлением по этому запросу нет.",
  requiresProfile:
    "Сохраните хотя бы одну специализацию в профессиональном профиле перед заявкой на подтверждение опыта.",
  teamPending: "Для этой организации уже есть заявка на рассмотрении.",
  alreadyPending: "Для этой цели уже есть заявка на рассмотрении.",
  alreadyVerified: "Эта цель уже подтверждена.",
  serverHint:
    "Контроль сервера подтверждается через MTA-проверку управления, а не ссылкой на доказательства.",
  servers: "Управление MTA-серверами",
  editProfile: "Редактировать профессиональный профиль",
  publicProfile: "Открыть публичный профиль",
  signIn: "Войдите для управления верификацией",
  unavailable: "Не удалось загрузить данные верификации. Попробуйте ещё раз.",
  mutationUnavailable:
    "Результат не удалось подтвердить. Загрузите сохранённый профиль или заявки перед повторным действием.",
  invalid: "Проверьте поля профиля, пояснение и ссылку на доказательства.",
  changed: "Профиль изменился. Загрузите актуальное состояние перед сохранением.",
  authorityChanged: "Текущая роль или права в организации не позволяют подать эту заявку.",
  profileChanged:
    "Профессиональный профиль изменился после подачи. Автор должен обновить доказательства перед одобрением.",
  selfReview: "Вашу заявку должен одобрить другой модератор.",
  reviewNotes: "Комментарий модератора",
  noApplications: "В этом разделе заявок нет.",
  all: "Все цели",
  type: "Тип верификации",
  search: "Найти",
  query: "Поиск организаций",
  previous: "Предыдущая страница",
  next: "Следующая страница",
  page: "Страница",
  reload: "Загрузить сохранённое состояние",
  loading: "Загрузка…",
  back: "К верификации",
  cancel: "Отмена",
  roleRequired: "Для редактирования нужна текущая роль разработчика или администратора.",
  submittedAt: "Подана",
  decidedAt: "Решение",
  identityHint: "Подтверждение личности не удостоверяет навыки или качество ресурсов.",
  decisionUnavailable:
    "Решение не удалось подтвердить. Перезагрузите очередь модерации перед повторным действием.",
  stateChanged: "Состояние заявки уже изменилось. Перезагрузите очередь модерации.",
};
export const verificationCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function verificationError(locale: Locale, code: unknown) {
  const copy = verificationCopy(locale);
  if (
    ["VALIDATION_ERROR", "UNSUPPORTED_MEDIA_TYPE", "REQUEST_BODY_TOO_LARGE"].includes(String(code))
  )
    return copy.invalid;
  if (code === "VERIFICATION_ALREADY_VERIFIED") return copy.alreadyVerified;
  if (code === "VERIFICATION_PENDING") return copy.alreadyPending;
  if (code === "VERIFICATION_AUTHORITY_CHANGED") return copy.authorityChanged;
  if (code === "VERIFICATION_PROFILE_REQUIRED") return copy.requiresProfile;
  if (code === "VERIFICATION_PROFILE_CHANGED") return copy.profileChanged;
  if (code === "VERIFICATION_SELF_REVIEW") return copy.selfReview;
  if (code === "VERIFICATION_STATE_CHANGED") return copy.stateChanged;
  if (code === "VERIFICATION_APPLICATION_CHANGED") return copy.stateChanged;
  if (code === "CONFLICT") return copy.changed;
  if (code === "INTERNAL_ERROR" || code === "UNCONFIRMED") return copy.unavailable;
  return userPlatformError(locale, code);
}
export const verificationMutationError = (locale: Locale, code: unknown) =>
  code === "INTERNAL_ERROR" || code === "UNCONFIRMED"
    ? verificationCopy(locale).mutationUnavailable
    : verificationError(locale, code);
export const verificationDecisionError = (locale: Locale, code: unknown) =>
  code === "INTERNAL_ERROR" || code === "UNCONFIRMED"
    ? verificationCopy(locale).decisionUnavailable
    : verificationError(locale, code);
