import { communityReportDecisionError } from "./community-report-copy";
import type { Locale } from "./i18n";

const en = {
  title: "Decide selected reports",
  help: "Select up to twenty reports on this page. Review the current comment and selected reasons before applying one recorded decision to them.",
  publicationHelp:
    "Select up to twenty reports on this publication. Review its current text and the selected reasons before applying the recorded decision.",
  publication: "Current publication",
  publicationActionHint:
    "Report decisions are recorded here. Open the publication moderation context to change its publication state.",
  publicationEmpty: "No matching reports about this publication.",
  select: "Select report",
  selectAll: "Select pending reports on this page",
  clear: "Clear selection",
  selected: "Selected reports",
  action: "Decision",
  notes: "Recorded moderation reason",
  preview: "Review batch",
  confirm: "Apply reviewed decision",
  cancel: "Back to selection",
  previewTitle: "Review the exact selected reports",
  comment: "Current comment",
  removed: "The comment is already removed.",
  truncated: "This preview is shortened; its saved version covers the complete text.",
  busy: "Checking selected reports…",
  saved: "The reviewed report decisions were saved.",
  changed: "A selected report or its target changed. Reload this page and review the batch again.",
  invalid: "The selected reports or decision are invalid.",
  uncertain: "The saved result could not be confirmed. Reload this page before another decision.",
  unavailable: "The batch could not be reviewed. Try again or reload the page.",
  reload: "Reload saved reports",
  empty: "Select at least one pending report.",
  transition: "Recorded status change",
  noRemoval:
    "This decision records report states. Comment removal is available in the individual moderation context.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Решение по выбранным жалобам",
  help: "Выберите до двадцати жалоб на этой странице. Перед общим записанным решением проверьте текущий комментарий и причины выбранных жалоб.",
  publicationHelp:
    "Выберите до двадцати жалоб на эту публикацию. Перед записанным решением проверьте её текущий текст и причины выбранных жалоб.",
  publication: "Текущая публикация",
  publicationActionHint:
    "Здесь записываются решения по жалобам. Для изменения состояния публикации откройте её контекст модерации.",
  publicationEmpty: "Подходящих жалоб на эту публикацию нет.",
  select: "Выбрать жалобу",
  selectAll: "Выбрать открытые жалобы на странице",
  clear: "Снять выбор",
  selected: "Выбрано жалоб",
  action: "Решение",
  notes: "Записанная причина решения",
  preview: "Проверить пакет",
  confirm: "Применить проверенное решение",
  cancel: "К выбору жалоб",
  previewTitle: "Проверка выбранных жалоб",
  comment: "Текущий комментарий",
  removed: "Комментарий уже удалён.",
  truncated: "Предпросмотр сокращён; версия учитывает полный текст.",
  busy: "Проверяем выбранные жалобы…",
  saved: "Проверенные решения по жалобам сохранены.",
  changed: "Выбранная жалоба или её цель изменились. Загрузите страницу и проверьте пакет заново.",
  invalid: "Выбранные жалобы или решение некорректны.",
  uncertain: "Не удалось подтвердить сохранение. Загрузите страницу перед новым решением.",
  unavailable: "Не удалось проверить пакет. Повторите попытку или загрузите страницу.",
  reload: "Загрузить сохранённые жалобы",
  empty: "Выберите хотя бы одну открытую жалобу.",
  transition: "Записанное изменение статуса",
  noRemoval:
    "Решение меняет состояния жалоб. Удаление комментария доступно в отдельном контексте модерации.",
};
export const reportBatchCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function reportBatchError(locale: Locale, code: unknown) {
  const copy = reportBatchCopy(locale);
  return code === "REPORT_BATCH_CHANGED" || code === "REPORT_STATE_CHANGED"
    ? copy.changed
    : code === "REPORT_BATCH_INVALID" || code === "VALIDATION_ERROR"
      ? copy.invalid
      : communityReportDecisionError(locale, code);
}
