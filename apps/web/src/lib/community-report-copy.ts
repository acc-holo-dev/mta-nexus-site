import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
const en = {
  title: "My community reports",
  description:
    "Track reports about publications and discussions. Moderation notes stay private to staff.",
  queue: "Community report queue",
  queueDescription:
    "Review publication and discussion reports. Commercial resource reviews use their existing moderation workflow.",
  report: "Report",
  reportTitle: "Report this content",
  category: "Category",
  reason: "Describe the violation",
  evidence: "Evidence links (one per line, up to 5)",
  submit: "Submit report",
  submitting: "Submitting…",
  cancel: "Cancel",
  saved: "Your report has been saved.",
  duplicate: "You already have a pending report for this target.",
  track: "Track report",
  myReports: "My reports",
  signIn: "Sign in to submit and track reports",
  pending: "Pending",
  history: "Decided",
  all: "All",
  content: "Publication",
  comment: "Comment",
  target: "Reported target",
  status: "Status",
  created: "Submitted",
  decided: "Decided",
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  dismissed: "Dismissed",
  scam: "Scam",
  copyright: "Copyright violation",
  malware: "Malware",
  abuse: "Abuse",
  fake_product: "Misleading resource",
  fake_server: "Misleading server",
  spam: "Spam",
  other: "Other",
  search: "Apply filters",
  textSearch: "Report text or ID",
  searchHint: "Literal text search, up to 80 characters.",
  queryInvalid: "Invalid report filters. Clear them and try again.",
  reset: "Clear filters",
  previous: "Previous page",
  next: "Next page",
  page: "Page",
  loading: "Loading…",
  empty: "No reports in this view.",
  unavailable: "Unable to load reports. Try again.",
  retry: "Try again",
  back: "Back to reports",
  detail: "Report details",
  currentTarget: "Current target content",
  currentHint: "This is the current content, which may have changed since the report was filed.",
  missing: "The target is unavailable or no longer public.",
  truncated: "Only the first 5,000 characters are shown.",
  viewTarget: "Open publication",
  author: "Author",
  reporter: "Reporter",
  notes: "Staff decision notes",
  notesHint:
    "At least 3 characters. These notes are stored in the audit and are visible only to staff.",
  review: "Take for review",
  resolve: "Resolve",
  dismiss: "Dismiss",
  remove_comment: "Remove comment and resolve",
  confirm: "Confirm decision",
  confirmRemove:
    "The comment will be removed and this report resolved. Replies will remain available.",
  confirmDecision: "Save this moderation decision?",
  decisionSaved: "Decision saved.",
  reload: "Load current report",
  forbidden: "Moderator access required.",
  invalid: "Check the report fields and evidence links.",
  ownTarget: "You cannot report your own publication or comment.",
  changed: "This report has changed. Load the current report before deciding again.",
  commentChanged: "The comment has changed. Load the current content before removing it.",
  targetUnavailable:
    "This target cannot be removed here. Load the current report and review its status.",
  mutationUnavailable: "The result could not be confirmed. Check your reports before trying again.",
  decisionUnavailable:
    "The result could not be confirmed. Load the current report before trying again.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Мои жалобы в сообществе",
  description:
    "Следите за жалобами на публикации и обсуждения. Заметки модераторов доступны только сотрудникам.",
  queue: "Жалобы сообщества",
  queueDescription:
    "Рассмотрение жалоб на публикации и обсуждения. Отзывы о коммерческих ресурсах используют существующий процесс модерации.",
  report: "Пожаловаться",
  reportTitle: "Жалоба на контент",
  category: "Категория",
  reason: "Опишите нарушение",
  evidence: "Ссылки на доказательства (по одной на строку, до 5)",
  submit: "Отправить жалобу",
  submitting: "Отправка…",
  cancel: "Отмена",
  saved: "Жалоба сохранена.",
  duplicate: "У вас уже есть незавершённая жалоба на эту цель.",
  track: "Открыть жалобу",
  myReports: "Мои жалобы",
  signIn: "Войдите, чтобы подавать жалобы и следить за ними",
  pending: "На рассмотрении",
  history: "Завершённые",
  all: "Все",
  content: "Публикация",
  comment: "Комментарий",
  target: "Цель жалобы",
  status: "Статус",
  created: "Подана",
  decided: "Решение",
  open: "Открыта",
  under_review: "Рассматривается",
  resolved: "Решена",
  dismissed: "Отклонена",
  scam: "Мошенничество",
  copyright: "Нарушение авторских прав",
  malware: "Вредоносный код",
  abuse: "Оскорбления",
  fake_product: "Недостоверный ресурс",
  fake_server: "Недостоверный сервер",
  spam: "Спам",
  other: "Другое",
  search: "Применить фильтры",
  textSearch: "Текст или ID жалобы",
  searchHint: "Поиск буквального текста, до 80 символов.",
  queryInvalid: "Некорректные фильтры жалоб. Сбросьте их и повторите попытку.",
  reset: "Сбросить фильтры",
  previous: "Предыдущая страница",
  next: "Следующая страница",
  page: "Страница",
  loading: "Загрузка…",
  empty: "В этом разделе жалоб нет.",
  unavailable: "Не удалось загрузить жалобы. Попробуйте ещё раз.",
  retry: "Повторить",
  back: "К списку жалоб",
  detail: "Подробности жалобы",
  currentTarget: "Текущее содержимое цели",
  currentHint: "Контент мог измениться после подачи жалобы. Здесь показана текущая версия.",
  missing: "Цель недоступна или больше не опубликована.",
  truncated: "Показаны первые 5 000 символов.",
  viewTarget: "Открыть публикацию",
  author: "Автор",
  reporter: "Заявитель",
  notes: "Заметки к решению",
  notesHint: "Не менее 3 символов. Заметки сохраняются в аудите и доступны только сотрудникам.",
  review: "Взять на рассмотрение",
  resolve: "Завершить",
  dismiss: "Отклонить",
  remove_comment: "Удалить комментарий и завершить",
  confirm: "Подтвердить решение",
  confirmRemove: "Комментарий будет удалён, а жалоба завершена. Ответы останутся доступными.",
  confirmDecision: "Сохранить это решение модерации?",
  decisionSaved: "Решение сохранено.",
  reload: "Загрузить актуальную жалобу",
  forbidden: "Нужны права модератора.",
  invalid: "Проверьте поля жалобы и ссылки на доказательства.",
  ownTarget: "Нельзя пожаловаться на свою публикацию или комментарий.",
  changed: "Состояние жалобы изменилось. Загрузите актуальную жалобу перед решением.",
  commentChanged: "Комментарий изменился. Загрузите актуальный текст перед удалением.",
  targetUnavailable:
    "Эту цель нельзя удалить здесь. Загрузите актуальную жалобу и проверьте её состояние.",
  mutationUnavailable:
    "Результат не удалось подтвердить. Проверьте свои жалобы перед повторной отправкой.",
  decisionUnavailable:
    "Результат не удалось подтвердить. Загрузите актуальную жалобу перед повторным действием.",
};
export const communityReportCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function communityReportError(locale: Locale, code: unknown) {
  const copy = communityReportCopy(locale);
  if (
    [
      "VALIDATION_ERROR",
      "UNSUPPORTED_MEDIA_TYPE",
      "REQUEST_BODY_TOO_LARGE",
      "INVALID_BODY_LENGTH",
    ].includes(String(code))
  )
    return copy.invalid;
  if (code === "REPORT_OWN_TARGET") return copy.ownTarget;
  if (code === "REPORT_STATE_CHANGED") return copy.changed;
  if (code === "COMMENT_CHANGED") return copy.commentChanged;
  if (code === "REPORT_TARGET_UNAVAILABLE") return copy.targetUnavailable;
  if (code === "INTERNAL_ERROR" || code === "UNCONFIRMED") return copy.unavailable;
  return userPlatformError(locale, code);
}
export const communityReportMutationError = (locale: Locale, code: unknown) =>
  code === "INTERNAL_ERROR" || code === "UNCONFIRMED"
    ? communityReportCopy(locale).mutationUnavailable
    : communityReportError(locale, code);
export const communityReportDecisionError = (locale: Locale, code: unknown) =>
  code === "INTERNAL_ERROR" || code === "UNCONFIRMED"
    ? communityReportCopy(locale).decisionUnavailable
    : communityReportError(locale, code);
