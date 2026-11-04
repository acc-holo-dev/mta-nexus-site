import type { Locale } from "./i18n";

const en = {
  title: "Reports about this comment",
  description:
    "Review pending and completed reports about this exact comment. Removing a comment does not decide other reports automatically.",
  open: "Related reports",
  search: "Search reported reasons",
  type: "Report category",
  view: "Report state",
  pending: "Pending reports",
  history: "Completed reports",
  all: "All categories",
  apply: "Apply filters",
  clear: "Clear filters",
  empty: "No matching reports for this comment.",
  emptyFiltered: "No reports match these filters.",
  review: "Review report",
  removed: "The comment is removed. Pending reports still require a recorded decision.",
  back: "Back to comment",
  link: "Open moderation context",
  unavailable: "Report context could not be loaded. Reload the comment or report.",
  loadUnavailable:
    "Comment reports are temporarily unavailable. This does not mean there are no reports.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Жалобы на этот комментарий",
  description:
    "Проверяйте открытые и завершённые жалобы на конкретный комментарий. Удаление комментария не решает остальные жалобы автоматически.",
  open: "Связанные жалобы",
  search: "Поиск по причинам жалоб",
  type: "Категория жалобы",
  view: "Состояние жалоб",
  pending: "Открытые жалобы",
  history: "Завершённые жалобы",
  all: "Все категории",
  apply: "Применить фильтры",
  clear: "Сбросить фильтры",
  empty: "Подходящих жалоб на этот комментарий нет.",
  emptyFiltered: "Нет жалоб по выбранным фильтрам.",
  review: "Проверить жалобу",
  removed: "Комментарий удалён. Открытые жалобы требуют отдельного записанного решения.",
  back: "К комментарию",
  link: "Открыть контекст модерации",
  unavailable: "Не удалось загрузить контекст жалобы. Загрузите комментарий или жалобу.",
  loadUnavailable: "Жалобы на комментарий временно недоступны. Это не означает, что жалоб нет.",
};
export const discussionReportsCopy = (locale: Locale) => (locale === "ru" ? ru : en);
