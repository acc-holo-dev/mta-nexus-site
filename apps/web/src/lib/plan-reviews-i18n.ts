const copy = {
  en: {
    title: "Saved plan reviews",
    newReview: "Save selected terms",
    back: "Back to plan catalog",
    save: "Save review",
    saving: "Saving…",
    signIn: "Sign in",
    signInRequired: "Sign in to review a plan",
    access: "This account is unavailable. Check your current organization permissions.",
    rate: "Too many requests. Wait before retrying the same selection.",
    personal: "Personal",
    organization: "Organization",
    account: "Account",
    all: "All time",
    days: "days",
    period: "Period",
    apply: "Apply",
    empty: "No saved reviews in this period.",
    revision: "Version",
    price: "Plan price",
    term: "Plan term",
    commission: "Commission",
    amount: "Example sale amount",
    currency: "Example sale currency",
    estimate: "Saved commission estimate",
    fee: "Estimated platform fee",
    proceeds: "Estimated seller proceeds",
    hold: "Initial hold baseline",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    export: "Download JSON",
    saved: "Recorded terms",
    latest: "Current published terms",
    current: "The selected version is still published.",
    changed: "A different version is published. Compare the terms before making a new selection.",
    unavailable: "The selected plan is no longer published. Saved terms remain historical.",
    observed: "Checked at",
    scopeNext: "More organizations",
    history: "View saved reviews",
    noOrganizations: "You do not manage an organization on this page.",
    invalid: "The request is invalid. Reload and check your selection.",
    retry:
      "The result could not be confirmed. Retry the same selection; it will not create a duplicate.",
    conflict:
      "The request key is already bound to a different selection. Reload before selecting again.",
    limit: "This account has reached the 500-review limit.",
    planChanged: "The published plan changed. Reload the catalog and review the latest terms.",
    notice:
      "A saved review records your selection and an illustrative fee estimate. It does not reserve a price, activate a subscription, charge money or grant benefits. Provider fees and taxes are excluded. License validity is separate from the plan term; resource licenses remain monthly and bound to one server.",
    baseline:
      "The initial hold baseline is 7 days. Estimated proceeds are not a balance or an available payout.",
    frozen:
      "After an uncertain result, keep this selection unchanged and retry. Reloading starts a new request.",
  },
  ru: {
    title: "Сохранённые обзоры тарифов",
    newReview: "Сохранить выбранные условия",
    back: "К каталогу тарифов",
    save: "Сохранить обзор",
    saving: "Сохранение…",
    signIn: "Войти",
    signInRequired: "Войдите для обзора тарифа",
    access: "Аккаунт недоступен. Проверьте текущие права в организации.",
    rate: "Слишком много запросов. Подождите перед повтором того же выбора.",
    personal: "Личный аккаунт",
    organization: "Организация",
    account: "Аккаунт",
    all: "За всё время",
    days: "дней",
    period: "Период",
    apply: "Применить",
    empty: "За этот период обзоров нет.",
    revision: "Версия",
    price: "Цена тарифа",
    term: "Срок тарифа",
    commission: "Комиссия",
    amount: "Сумма продажи для примера",
    currency: "Валюта продажи для примера",
    estimate: "Сохранённый расчёт комиссии",
    fee: "Расчётная комиссия платформы",
    proceeds: "Расчётная сумма продавца",
    hold: "Исходный срок удержания",
    previous: "Назад",
    next: "Далее",
    page: "Страница",
    of: "из",
    export: "Скачать JSON",
    saved: "Сохранённые условия",
    latest: "Текущие опубликованные условия",
    current: "Выбранная версия ещё опубликована.",
    changed: "Опубликована другая версия. Сравните условия перед новым выбором.",
    unavailable: "Тариф больше не опубликован. Сохранённые условия остаются историей.",
    observed: "Проверено",
    scopeNext: "Другие организации",
    history: "История обзоров",
    noOrganizations: "На этой странице нет организаций под вашим управлением.",
    invalid: "Некорректный запрос. Обновите страницу и проверьте выбор.",
    retry: "Результат не подтверждён. Повторите тот же выбор — дубликат не появится.",
    conflict: "Ключ запроса уже связан с другим выбором. Обновите страницу перед новым выбором.",
    limit: "Достигнут лимит: 500 обзоров на аккаунт.",
    planChanged: "Опубликованный тариф изменился. Обновите каталог и проверьте новые условия.",
    notice:
      "Обзор сохраняет ваш выбор и пример расчёта комиссии. Он не резервирует цену, не активирует подписку, не списывает деньги и не выдаёт преимущества. Комиссии провайдера и налоги не учтены. Срок лицензии отдельный: лицензия ресурса действует месяц и привязана к одному серверу.",
    baseline:
      "Исходное удержание — 7 дней. Расчётная сумма продавца не является балансом или доступной выплатой.",
    frozen:
      "После неопределённого результата повторите неизменённый выбор. Обновление страницы начинает новый запрос.",
  },
};
export const planReviewsCopy = (locale: "en" | "ru") => copy[locale];
export function planReviewError(locale: "en" | "ru", code: unknown) {
  const c = copy[locale];
  if (code === "UNAUTHORIZED") return c.signInRequired;
  if (code === "FORBIDDEN" || code === "NOT_FOUND") return c.access;
  if (code === "RATE_LIMIT_EXCEEDED") return c.rate;
  return code === "PLAN_REVIEW_CONFLICT"
    ? c.conflict
    : code === "PLAN_REVIEW_PLAN_CHANGED"
      ? c.planChanged
      : code === "PLAN_REVIEW_LIMIT"
        ? c.limit
        : code === "PLAN_REVIEW_INVALID"
          ? c.invalid
          : c.retry;
}
