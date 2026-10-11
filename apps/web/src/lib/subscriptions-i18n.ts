import type { Locale } from "./i18n";

const en = {
  title: "My subscription",
  activate: "Activate free plan",
  cancel: "End subscription now",
  history: "Subscription history",
  recorded: "Recorded subscription operation",
  catalog: "Plan catalog",
  personal: "Personal account",
  organization: "Organization",
  account: "Account",
  open: "Open",
  scopeMore: "More organizations",
  empty: "No subscription for this account.",
  notice:
    "Published free plans can be activated without payment. Paid activation awaits a payment provider. One plan may be active per personal or organization account. The recorded terms last for the fixed period; renewal is manual after expiry. Resource licenses, payments, holds and balances are separate.",
  feeNote:
    "This is an estimate using the account's current subscription rate. It does not charge a commission, settle funds or grant access. The initial hold remains seven days.",
  expiredNote:
    "The subscription has expired. Choose a currently published free plan to start a new period.",
  cancelNote:
    "Ending the subscription removes its benefits immediately. Its recorded period and operation history remain available.",
  confirmCancel: "I confirm ending the benefits now",
  started: "Started",
  expires: "Expires",
  ended: "Ended",
  revision: "Plan version",
  rate: "Configured commission rate",
  hold: "Initial hold",
  days: "days",
  status: "Current state",
  noRenewal: "No automatic renewal",
  snapshot: "Terms recorded for this operation",
  current: "Current subscription state",
  done: "Operation recorded",
  export: "Download operation JSON",
  signIn: "Sign in",
  signInRequired: "Sign in to manage your subscription",
  busy: "Saving…",
  retry:
    "The result could not be confirmed. Retry this fixed request or check subscription history.",
  frozen:
    "The request is fixed for safe retries. Check history before reloading to change the selection.",
  invalid: "Check the plan, account and request details.",
  changed: "The published plan changed. Reload and review its current version.",
  alreadyActive:
    "This account already has an active subscription. End it or wait for expiry before choosing a new plan.",
  paymentRequired:
    "Only free plans can currently be activated. This paid plan requires a payment provider.",
  conflict: "This request has already been used with different details. Check history.",
  stateChanged: "The subscription state changed or its term ended. Reload its current state.",
  limit: "This account has reached its limit of 500 subscription periods.",
  unavailable: "The subscription account or operation is unavailable to you.",
  rateLimited: "Too many requests. Wait and retry.",
  period: "Period",
  all: "All time",
  filter: "Apply",
  previous: "Previous",
  next: "Next",
  total: "Operations",
  historyEmpty: "No operations in this period.",
  amount: "Transaction amount",
  currency: "Currency",
  calculate: "Estimate using my rate",
  estimate: "Estimated fee",
  proceeds: "Estimated seller proceeds",
  estimateFailed: "The fee estimate could not be confirmed. Try again.",
  actions: { activate: "Free plan activated", cancel: "Subscription ended" },
  statuses: { active: "Active", expired: "Expired", cancelled: "Ended" },
};
const ru: typeof en = {
  title: "Моя подписка",
  activate: "Подключить бесплатный тариф",
  cancel: "Прекратить подписку сейчас",
  history: "История подписки",
  recorded: "Сохранённая операция подписки",
  catalog: "Каталог тарифов",
  personal: "Личный аккаунт",
  organization: "Организация",
  account: "Аккаунт",
  open: "Открыть",
  scopeMore: "Другие организации",
  empty: "У этого аккаунта нет подписки.",
  notice:
    "Опубликованные бесплатные тарифы можно подключить без оплаты. Платное подключение ожидает интеграции провайдера. У личного аккаунта или организации может действовать один тариф. Зафиксированные условия действуют до окончания срока; новый период подключается вручную после истечения. Лицензии ресурсов, платежи, удержания и баланс учитываются отдельно.",
  feeNote:
    "Это расчёт по текущей ставке подписки аккаунта. Он не списывает комиссию, не переводит деньги и не выдаёт доступ. Начальное удержание остаётся семь дней.",
  expiredNote:
    "Срок подписки истёк. Выберите актуальный опубликованный бесплатный тариф для нового периода.",
  cancelNote:
    "Прекращение подписки сразу отключает её преимущества. Зафиксированный срок и история операций сохраняются.",
  confirmCancel: "Подтверждаю прекращение преимуществ сейчас",
  started: "Начало",
  expires: "Окончание",
  ended: "Прекращено",
  revision: "Версия тарифа",
  rate: "Настроенная ставка комиссии",
  hold: "Начальное удержание",
  days: "дней",
  status: "Текущее состояние",
  noRenewal: "Без автоматического продления",
  snapshot: "Условия на момент операции",
  current: "Текущее состояние подписки",
  done: "Операция сохранена",
  export: "Скачать операцию в JSON",
  signIn: "Войти",
  signInRequired: "Войдите для управления подпиской",
  busy: "Сохранение…",
  retry:
    "Результат не удалось подтвердить. Повторите зафиксированный запрос или проверьте историю подписки.",
  frozen:
    "Запрос зафиксирован для безопасного повтора. Проверьте историю перед обновлением страницы и сменой выбора.",
  invalid: "Проверьте тариф, аккаунт и данные запроса.",
  changed: "Опубликованный тариф изменился. Обновите страницу и проверьте его актуальную версию.",
  alreadyActive:
    "У этого аккаунта уже есть действующая подписка. Прекратите её или дождитесь окончания срока перед выбором нового тарифа.",
  paymentRequired:
    "Сейчас можно подключить только бесплатный тариф. Для этого платного тарифа нужен провайдер платежей.",
  conflict: "Этот запрос уже использован с другими данными. Проверьте историю.",
  stateChanged: "Состояние подписки изменилось или её срок истёк. Обновите актуальное состояние.",
  limit: "Аккаунт достиг предела в 500 периодов подписки.",
  unavailable: "Аккаунт подписки или операция вам недоступны.",
  rateLimited: "Слишком много запросов. Подождите и повторите.",
  period: "Период",
  all: "Всё время",
  filter: "Применить",
  previous: "Назад",
  next: "Далее",
  total: "Операций",
  historyEmpty: "За этот период нет операций.",
  amount: "Сумма сделки",
  currency: "Валюта",
  calculate: "Рассчитать по моей ставке",
  estimate: "Расчётная комиссия",
  proceeds: "Расчётная сумма продавцу",
  estimateFailed: "Расчёт комиссии не удалось подтвердить. Попробуйте снова.",
  actions: { activate: "Бесплатный тариф подключён", cancel: "Подписка прекращена" },
  statuses: { active: "Действует", expired: "Истекла", cancelled: "Прекращена" },
};
export const subscriptionsCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function subscriptionError(locale: Locale, code: unknown) {
  const c = subscriptionsCopy(locale);
  switch (code) {
    case "SUBSCRIPTION_INVALID":
      return c.invalid;
    case "SUBSCRIPTION_PLAN_CHANGED":
      return c.changed;
    case "SUBSCRIPTION_ALREADY_ACTIVE":
      return c.alreadyActive;
    case "SUBSCRIPTION_PAYMENT_REQUIRED":
      return c.paymentRequired;
    case "SUBSCRIPTION_REQUEST_CONFLICT":
      return c.conflict;
    case "SUBSCRIPTION_STATE_CHANGED":
      return c.stateChanged;
    case "SUBSCRIPTION_LIMIT":
      return c.limit;
    case "NOT_FOUND":
    case "FORBIDDEN":
    case "SUBSCRIPTION_TERMS_UNKNOWN":
      return c.unavailable;
    case "UNAUTHORIZED":
      return c.signInRequired;
    case "RATE_LIMIT_EXCEEDED":
      return c.rateLimited;
    default:
      return c.retry;
  }
}
