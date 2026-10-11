import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
const en = {
  loading: "Loading trust signals…",
  title: "Trust and verification",
  description: "Current verification and public participation, with clear sources and scope.",
  back: "Back to profile",
  identity: "Identity verification",
  developer: "Developer experience",
  verified: "Currently verified",
  notVerified: "No current verification",
  approval: "Latest recorded approval",
  noDate: "An approval date is not recorded.",
  identityScope:
    "This is the account’s current identity verification flag. It is separate from developer experience and server control.",
  developerScope:
    "This is the current experience badge for a developer profile. It is not a review of every resource or a guarantee of future work.",
  joined: "Joined NEXUS",
  joinedScope:
    "Account creation date. Account age alone does not establish quality or reliability.",
  servers: "Public active servers owned",
  organizations: "Organizations owned",
  verifiedSubset: "Currently verified",
  ownershipScope:
    "Current ownership, not past membership or work history. Hidden and inactive servers are excluded.",
  publications: "Public publications",
  hiddenActivity: "Activity is hidden by the profile owner.",
  activity: "Browse public activity",
  publicationScope:
    "Currently published materials. Publication and reader reactions do not independently verify professional experience.",
  limits: "How to read these signals",
  limitsDescription:
    "These signals reflect current stored records, not a complete verification history or an overall reputation score. An absent badge does not mean an adverse decision. Verification evidence and private review notes are not public.",
  unavailable: "Trust signals could not be loaded. Try again.",
  reload: "Reload",
  notFound: "Profile not found",
  settings: "Manage verification",
  source: "Source: NEXUS account and verification records",
};
const ru: Record<keyof typeof en, string> = {
  loading: "Загрузка сведений о доверии…",
  title: "Доверие и верификация",
  description: "Текущие подтверждения и публичное участие с понятными источниками и границами.",
  back: "К профилю",
  identity: "Подтверждение личности",
  developer: "Опыт разработчика",
  verified: "Подтверждено сейчас",
  notVerified: "Нет текущего подтверждения",
  approval: "Последнее записанное одобрение",
  noDate: "Дата одобрения не записана.",
  identityScope:
    "Текущий флаг подтверждения личности аккаунта. Он независим от подтверждения опыта разработчика и контроля сервера.",
  developerScope:
    "Текущий знак подтверждения опыта в профиле разработчика. Он не подтверждает качество каждого ресурса и не гарантирует будущую работу.",
  joined: "Регистрация в NEXUS",
  joinedScope:
    "Дата создания аккаунта. Возраст аккаунта сам по себе не подтверждает качество или надёжность.",
  servers: "Публичные активные серверы во владении",
  organizations: "Организации во владении",
  verifiedSubset: "С текущим подтверждением",
  ownershipScope:
    "Текущее владение, а не прошлое участие в команде или история работы. Скрытые и неактивные серверы исключены.",
  publications: "Публичные публикации",
  hiddenActivity: "Владелец профиля скрыл активность.",
  activity: "Посмотреть публичную активность",
  publicationScope:
    "Материалы, опубликованные сейчас. Публикации и реакции читателей сами по себе не подтверждают профессиональный опыт.",
  limits: "Как читать эти сведения",
  limitsDescription:
    "Сведения отражают текущие записи, а не полную историю верификации или общий балл репутации. Отсутствие знака не означает отрицательного решения. Доказательства и внутренние заметки проверяющих не публикуются.",
  unavailable: "Не удалось загрузить сведения о доверии. Попробуйте ещё раз.",
  reload: "Обновить",
  notFound: "Профиль не найден",
  settings: "Управление верификацией",
  source: "Источник: записи аккаунта и верификации NEXUS",
};
export const trustCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export const trustError = (locale: Locale, code: unknown) =>
  code === "INTERNAL_ERROR"
    ? trustCopy(locale).unavailable
    : code === "NOT_FOUND"
      ? trustCopy(locale).notFound
      : userPlatformError(locale, code);
