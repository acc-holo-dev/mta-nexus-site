import type { Locale } from "../../lib/i18n";

const en = {
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  notFound: "Report target was not found",
  unsupportedMediaType: "Request must use application/json",
  requestBodyTooLarge: "Request body is too large",
  invalidBodyLength: "Request body length is invalid",
  requestBodyTimeout: "Request body timed out",
  invalidPageOrView: "Invalid report page or view",
  listFailed: "Failed to load reports",
  authenticationRequired: "Authentication required to submit report",
  rate: "Too many reports submitted. Please try again later.",
  validationFailed: "Validation error",
  cannotReportSelf: "You cannot report your own account",
  alreadyOpen: "You already have an open report for this target",
  retry: "Please retry submitting the report",
  submitFailed: "Failed to submit report",
};

const ru: Record<keyof typeof en, string> = {
  unauthorized: "Нет доступа",
  forbidden: "Запрещено",
  notFound: "Цель жалобы не найдена",
  unsupportedMediaType: "Запрос должен использовать application/json",
  requestBodyTooLarge: "Тело запроса слишком большое",
  invalidBodyLength: "Некорректная длина тела запроса",
  requestBodyTimeout: "Истекло время ожидания тела запроса",
  invalidPageOrView: "Некорректная страница или вид жалоб",
  listFailed: "Не удалось загрузить жалобы",
  authenticationRequired: "Чтобы отправить жалобу, требуется вход",
  rate: "Слишком много жалоб. Попробуйте позже.",
  validationFailed: "Ошибка проверки данных",
  cannotReportSelf: "Нельзя пожаловаться на собственный аккаунт",
  alreadyOpen: "У вас уже есть открытая жалоба на эту цель",
  retry: "Повторите отправку жалобы",
  submitFailed: "Не удалось отправить жалобу",
};

export const reportsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
