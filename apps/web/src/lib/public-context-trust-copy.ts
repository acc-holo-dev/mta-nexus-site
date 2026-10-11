import type { Locale } from "./i18n";
import { approvalError } from "./public-verification-history-copy";
const en = {
  title: "Verification and public activity",
  description:
    "Current recorded verification and retained dated approvals for this public context.",
  back: "Back to public page",
  organization: "Organization",
  server: "MTA server",
  created: "Registered in NEXUS",
  current: "Current recorded verification",
  verified: "Currently verified",
  unverified: "No current verification",
  publications: "Public publications",
  servers: "Active public servers",
  verifiedServers: "Verified among them",
  activity: "Browse public activity",
  affiliation: "Current organization",
  ownership: "Current management context",
  personal: "Personal account",
  unclaimed: "No recorded owner",
  history: "Recorded approvals",
  approved: "Approval recorded",
  latest: "Latest records",
  older: "Older records",
  empty: "No dated approvals are recorded on this page.",
  loading: "Loading public verification…",
  unavailable: "Public verification could not be loaded. Try again.",
  organizationScope:
    "The organization flag is separate from personal verification and team permissions. Counts include current public publications and active public servers; private team membership and commercial records are excluded.",
  serverScope:
    "The server flag records verified control in NEXUS. It does not measure uptime, player counts, service quality or installed-file integrity. Historical approvals do not establish current control or the identity of a current personal owner.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Верификация и публичная активность",
  description:
    "Текущее записанное подтверждение и сохранённые одобрения с датами для публичного контекста.",
  back: "К публичной странице",
  organization: "Организация",
  server: "MTA-сервер",
  created: "Регистрация в NEXUS",
  current: "Текущее записанное подтверждение",
  verified: "Подтверждено сейчас",
  unverified: "Нет текущего подтверждения",
  publications: "Публичные публикации",
  servers: "Активные публичные серверы",
  verifiedServers: "Из них подтверждены",
  activity: "Посмотреть публичную активность",
  affiliation: "Текущая организация",
  ownership: "Текущий контекст управления",
  personal: "Личный аккаунт",
  unclaimed: "Владелец не записан",
  history: "Записанные одобрения",
  approved: "Одобрение записано",
  latest: "Новые записи",
  older: "Старые записи",
  empty: "На этой странице нет записанных одобрений с датами.",
  loading: "Загрузка публичной верификации…",
  unavailable: "Не удалось загрузить публичную верификацию. Попробуйте ещё раз.",
  organizationScope:
    "Подтверждение организации отделено от личной верификации и прав команды. Счётчики включают текущие публичные публикации и активные публичные серверы; приватный состав команды и коммерческие записи исключены.",
  serverScope:
    "Серверный статус отражает подтверждённый контроль в NEXUS. Он не измеряет время работы, онлайн, качество сервиса или целостность установленных файлов. Прошлое одобрение не подтверждает текущий контроль или личность нынешнего персонального владельца.",
};
export const contextTrustCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export const contextTrustError = (locale: Locale, code: unknown) =>
  code === "INTERNAL_ERROR" ? contextTrustCopy(locale).unavailable : approvalError(locale, code);
