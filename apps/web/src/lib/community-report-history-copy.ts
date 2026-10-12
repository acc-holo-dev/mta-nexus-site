import { communityReportError } from "./community-report-copy";
import type { Locale } from "./i18n";

const en = {
  title: "Report activity",
  description: "Recorded submission and moderation steps for this report.",
  staffHint:
    "Decision notes are visible only to current moderators. The snapshot fixes event time; the report status shown is current.",
  ownHint:
    "You can see recorded review stages. Staff notes and identities remain private. The report status shown is current.",
  groups: {
    all: "All activity",
    submission: "Submission",
    review: "Review",
    decision: "Decisions",
  },
  actions: {
    "report.created": "Report submitted",
    "report.review": "Taken for review",
    "report.resolve": "Report resolved",
    "report.dismiss": "Report dismissed",
    "report.remove_comment": "Comment removed and report resolved",
  },
  by: { requester: "Requester", staff: "Moderation team", unknown: "Actor not recorded" },
  back: "Back to report",
  empty: "No recorded events match these filters.",
  download: "Download this page (JSON)",
  exportHint:
    "This download contains the displayed page. Staff exports also include private decision notes.",
  older: "Earlier events",
  latest: "Latest activity",
  apply: "Apply filters",
  reset: "Reset filters",
  period: "Period",
  group: "Activity",
  snapshot: "Event snapshot",
  notes: "Decision notes",
  removed: "Comment removal recorded",
  batch: "Reports in the reviewed batch",
  unknown: "Transition not recorded",
  loading: "Loading report activity…",
  invalid: "Invalid report activity filters. Reset the filters and try again.",
  expired: "This activity page is no longer available. Open the latest activity.",
  unavailable: "Report activity could not be loaded. Try again.",
};
const ru: typeof en = {
  title: "История жалобы",
  description: "Записанные этапы подачи и рассмотрения этой жалобы.",
  staffHint:
    "Заметки к решениям доступны только действующим модераторам. Снимок фиксирует время событий; статус жалобы показан актуальный.",
  ownHint:
    "Вам доступны записанные этапы рассмотрения. Заметки и личности сотрудников остаются приватными. Статус жалобы показан актуальный.",
  groups: { all: "Все события", submission: "Подача", review: "Рассмотрение", decision: "Решения" },
  actions: {
    "report.created": "Жалоба подана",
    "report.review": "Взята на рассмотрение",
    "report.resolve": "Жалоба завершена",
    "report.dismiss": "Жалоба отклонена",
    "report.remove_comment": "Комментарий удалён, жалоба завершена",
  },
  by: { requester: "Заявитель", staff: "Команда модерации", unknown: "Автор действия не записан" },
  back: "Вернуться к жалобе",
  empty: "По этим фильтрам записанных событий нет.",
  download: "Скачать эту страницу (JSON)",
  exportHint:
    "Выгрузка содержит отображаемую страницу. Выгрузка модератора также включает приватные заметки к решениям.",
  older: "Более ранние события",
  latest: "Последние события",
  apply: "Применить фильтры",
  reset: "Сбросить фильтры",
  period: "Период",
  group: "События",
  snapshot: "Снимок событий",
  notes: "Заметки к решению",
  removed: "Удаление комментария записано",
  batch: "Жалоб в рассмотренной группе",
  unknown: "Переход статуса не записан",
  loading: "Загрузка истории жалобы…",
  invalid: "Некорректные фильтры истории жалобы. Сбросьте их и повторите попытку.",
  expired: "Эта страница истории больше недоступна. Откройте последние события.",
  unavailable: "Не удалось загрузить историю жалобы. Повторите попытку.",
};
export const reportHistoryCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function reportHistoryError(locale: Locale, code: unknown) {
  if (code === "CHANGE_HISTORY_FILTER_INVALID" || code === "INVALID_CURSOR")
    return reportHistoryCopy(locale).invalid;
  if (code === "REPORT_HISTORY_EXPIRED") return reportHistoryCopy(locale).expired;
  return communityReportError(locale, code);
}
