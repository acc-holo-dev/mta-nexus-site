import type { Locale } from "../../lib/i18n";

const en = {
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  notFound: "Verification target was not found",
  conflict: "Verification state changed",
  unsupportedMediaType: "Request must use application/json",
  requestBodyTooLarge: "Request body is too large",
  invalidBodyLength: "Request body length is invalid",
  requestBodyTimeout: "Request body timed out",
  loadFailed: "Failed to load verification requests",
  authenticationRequired: "Authentication required",
  rate: "Too many verification requests. Please try again tomorrow.",
  invalidRequest: "Invalid verification request",
  serverChallengeRequired: "Server ownership verification requires the MTA control challenge flow.",
  ownProfileOnly: "You can only verify your own profile",
  organizationNotFound: "Organization was not found",
  organizationNotManaged: "You do not manage this organization",
  alreadyVerified: "This target is already verified",
  alreadyPending: "A verification request is already pending",
  retry: "Please retry the application",
  submitFailed: "Failed to submit verification request",
};

const ru: Record<keyof typeof en, string> = {
  unauthorized: "Нет доступа",
  forbidden: "Запрещено",
  notFound: "Цель верификации не найдена",
  conflict: "Состояние верификации изменилось",
  unsupportedMediaType: "Запрос должен использовать application/json",
  requestBodyTooLarge: "Тело запроса слишком большое",
  invalidBodyLength: "Некорректная длина тела запроса",
  requestBodyTimeout: "Истекло время ожидания тела запроса",
  loadFailed: "Не удалось загрузить запросы на верификацию",
  authenticationRequired: "Требуется вход",
  rate: "Слишком много запросов на верификацию. Попробуйте завтра.",
  invalidRequest: "Некорректный запрос на верификацию",
  serverChallengeRequired: "Верификация владения сервером требует flow MTA control challenge.",
  ownProfileOnly: "Можно верифицировать только свой профиль",
  organizationNotFound: "Организация не найдена",
  organizationNotManaged: "Вы не управляете этой организацией",
  alreadyVerified: "Эта цель уже верифицирована",
  alreadyPending: "Запрос на верификацию уже ожидает рассмотрения",
  retry: "Повторите подачу заявки",
  submitFailed: "Не удалось отправить запрос на верификацию",
};

export const verificationApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
