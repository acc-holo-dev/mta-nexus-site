import type { Locale } from "./i18n";
import { verificationError } from "./verification-workspace-copy";

const en = {
  title: "My verification applications",
  description:
    "Search your submitted evidence and moderator feedback, and update an application still awaiting review.",
  detail: "Application details",
  search: "Search applications",
  query: "Explanation, feedback or application ID",
  status: "Application status",
  all: "All",
  empty: "No matching applications on this page.",
  open: "Open application",
  latest: "Latest applications",
  older: "Older applications",
  newer: "Newer applications",
  live: "Pages show current data. Evidence updates keep the original submission date.",
  amend: "Update evidence",
  confirm:
    "Replace this pending application's evidence URL and explanation with the fields shown? For an experience application, the current professional profile will be submitted for review. This does not grant verification.",
  saved: "Evidence saved. The application remains pending review.",
  uncertain: "The saved evidence could not be confirmed. Reload before another action.",
  invalid: "Check application filters, explanation and evidence URL.",
  changed: "The application or its evidence changed. Reload the saved version.",
  readOnly: "MTA control proofs and resolved applications cannot be edited here.",
  current: "The submitted professional profile matches the current saved profile.",
  profileChanged:
    "Your professional profile changed after submission. If this application is pending, review your profile and update its evidence before approval.",
  unknown:
    "The submitted profile version was not recorded. Update pending evidence to submit the current profile.",
  events: "Recent retained activity",
  earlier: "Only the twenty latest retained events are shown.",
  requested: "Application submitted",
  updated: "Evidence updated",
  approved: "Approved",
  rejected: "Rejected",
  noEvents: "No retained events yet.",
  truncated:
    "Some stored text exceeds this view's limits. Saving replaces the complete explanation with the fields shown.",
  privacy: "Evidence and moderator feedback are private to you and staff.",
  loading: "Loading applications…",
};
const ru: Record<keyof typeof en, string> = {
  title: "Мои заявки на верификацию",
  description:
    "Ищите поданные доказательства и ответы модераторов, обновляйте заявки, которые ещё рассматриваются.",
  detail: "Карточка заявки",
  search: "Найти заявки",
  query: "Пояснение, ответ или ID заявки",
  status: "Статус заявки",
  all: "Все",
  empty: "На этой странице нет подходящих заявок.",
  open: "Открыть заявку",
  latest: "Последние заявки",
  older: "Ранние заявки",
  newer: "Более новые заявки",
  live: "Страницы показывают текущее состояние. Обновление доказательств сохраняет первоначальную дату подачи.",
  amend: "Обновить доказательства",
  confirm:
    "Заменить ссылку и пояснение ожидающей заявки показанными полями? Для заявки на подтверждение опыта на рассмотрение будет отправлен текущий профессиональный профиль. Это не подтверждает верификацию.",
  saved: "Доказательства сохранены. Заявка остаётся на рассмотрении.",
  uncertain:
    "Сохранённые доказательства не удалось подтвердить. Загрузите актуальную версию перед следующим действием.",
  invalid: "Проверьте фильтры заявки, пояснение и ссылку на доказательства.",
  changed: "Заявка или её доказательства изменились. Загрузите сохранённую версию.",
  readOnly: "Подтверждения управления MTA и завершённые заявки здесь не редактируются.",
  current: "Поданный профессиональный профиль соответствует текущему сохранённому профилю.",
  profileChanged:
    "После подачи профессиональный профиль изменился. Если заявка ещё рассматривается, проверьте профиль и обновите доказательства перед одобрением.",
  unknown:
    "Версия поданного профиля не была записана. Обновите доказательства ожидающей заявки, чтобы отправить текущий профиль.",
  events: "Последние сохранённые события",
  earlier: "Показаны только двадцать последних сохранённых событий.",
  requested: "Заявка подана",
  updated: "Доказательства обновлены",
  approved: "Одобрена",
  rejected: "Отклонена",
  noEvents: "Сохранённых событий пока нет.",
  truncated:
    "Часть сохранённого текста превышает пределы отображения. Сохранение заменит полное пояснение показанными полями.",
  privacy: "Доказательства и ответ модерации доступны только вам и сотрудникам.",
  loading: "Загрузка заявок…",
};
export const verificationApplicationsCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function verificationApplicationsError(locale: Locale, code: unknown) {
  const copy = verificationApplicationsCopy(locale);
  if (code === "VERIFICATION_APPLICATION_CHANGED") return copy.changed;
  if (code === "VERIFICATION_APPLICATION_READ_ONLY") return copy.readOnly;
  if (code === "INVALID_CURSOR" || code === "VALIDATION_ERROR") return copy.invalid;
  return verificationError(locale, code);
}
