import { communityReportError } from "./community-report-copy";
import type { Locale } from "./i18n";

const en = {
  title: "Reports grouped by target",
  description:
    "Review reports about the same publication or comment together. Counts include matching reports in the selected time window, and their states are current.",
  order:
    "Targets are ordered by their earliest matching report. New ordinary reports after the snapshot are excluded; moderation decisions can remove a target from this view.",
  open: "Group reports by target",
  back: "All reports",
  inspect: "Review related reports",
  context: "Open moderation context",
  unknown: "Target unavailable or its community context could not be verified.",
  first: "First matching report",
  last: "Latest matching report",
  period: "Period",
  view: "View",
  pending: "Targets with pending reports",
  history: "Targets with completed reports",
  search: "Report text or ID",
  type: "Category",
  target: "Target",
  all: "All",
  apply: "Apply filters",
  reset: "Reset filters",
  latest: "Refresh groups",
  more: "More targets",
  snapshot: "Report snapshot",
  empty: "No targets match these filters.",
  loading: "Loading report groups…",
  publicationLoading: "Loading publication reports…",
  invalid: "Invalid group filters. Reset them and try again.",
  expired: "This group is no longer in the current queue. Refresh the groups.",
  unavailable: "Report groups could not be loaded. Try again.",
  publicationTitle: "Reports about this publication",
  publicationDescription:
    "Review the current publication and decide selected reports. Each decision is recorded; the requester can track its status.",
  publicationBody: "Current publication text",
  publicationCurrent: "The publication text may have changed since these reports were submitted.",
  publicationEmpty: "No matching reports about this publication.",
};
const ru: typeof en = {
  title: "Жалобы по целям",
  description:
    "Рассматривайте вместе жалобы на одну публикацию или комментарий. Счётчики учитывают подходящие жалобы в выбранном периоде, их состояния показаны актуальными.",
  order:
    "Цели упорядочены по первой подходящей жалобе. Новые обычные жалобы после снимка исключены; решения модераторов могут убрать цель из этого списка.",
  open: "Сгруппировать по целям",
  back: "Все жалобы",
  inspect: "Рассмотреть связанные жалобы",
  context: "Открыть контекст модерации",
  unknown: "Цель недоступна или её связь с сообществом не подтверждена.",
  first: "Первая подходящая жалоба",
  last: "Последняя подходящая жалоба",
  period: "Период",
  view: "Раздел",
  pending: "Цели с открытыми жалобами",
  history: "Цели с завершёнными жалобами",
  search: "Текст или ID жалобы",
  type: "Категория",
  target: "Цель",
  all: "Все",
  apply: "Применить фильтры",
  reset: "Сбросить фильтры",
  latest: "Обновить группы",
  more: "Следующие цели",
  snapshot: "Снимок жалоб",
  empty: "Подходящих целей по этим фильтрам нет.",
  loading: "Загрузка групп жалоб…",
  publicationLoading: "Загрузка жалоб на публикацию…",
  invalid: "Некорректные фильтры групп. Сбросьте их и повторите попытку.",
  expired: "Этой группы больше нет в текущей очереди. Обновите список.",
  unavailable: "Не удалось загрузить группы жалоб. Повторите попытку.",
  publicationTitle: "Жалобы на эту публикацию",
  publicationDescription:
    "Проверьте текущую публикацию и примите решения по выбранным жалобам. Каждое решение сохраняется; заявитель может отслеживать его статус.",
  publicationBody: "Текущий текст публикации",
  publicationCurrent: "Публикация могла измениться после подачи этих жалоб.",
  publicationEmpty: "Подходящих жалоб на эту публикацию нет.",
};
export const reportGroupsCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function reportGroupsError(locale: Locale, code: unknown) {
  if (code === "CHANGE_HISTORY_FILTER_INVALID" || code === "INVALID_CURSOR")
    return reportGroupsCopy(locale).invalid;
  if (code === "REPORT_GROUPS_EXPIRED") return reportGroupsCopy(locale).expired;
  return communityReportError(locale, code);
}
