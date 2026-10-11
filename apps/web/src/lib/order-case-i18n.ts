import type {
  OrderCaseKind,
  OrderCaseReview,
  OrderCaseReviewStatus,
  SupportCaseStatus,
} from "@nexus/domain";

const en = {
  title: "Purchase support",
  queue: "Purchase cases",
  create: "Open a purchase case",
  existing: "Continue the existing case",
  back: "Back to purchase cases",
  intro:
    "One case keeps the complete conversation and review history for this order. Continue or reopen it when you need further help.",
  financeNote:
    "These are recorded order and payment states, not verification from a payment provider. A refund recommendation does not transfer money, change access or record a successful refund.",
  subject: "Subject",
  message: "Describe the issue",
  kind: "Issue",
  amount: "Requested amount",
  amountHelp:
    "Use the order currency and at most two decimal places. A refund request requires a positive amount within the order total; a dispute may omit it.",
  send: "Submit case",
  busy: "Saving…",
  saved: "Saved. Open the case to read the result.",
  uncertain:
    "The result could not be confirmed. Retry the same request or reload the saved case before taking another action.",
  conflict: "The case, conversation or order records changed. Reload before reviewing again.",
  exists:
    "This order already has a case. Your new message was not added; open the existing conversation to continue.",
  invalid: "Check the subject, message and requested amount.",
  failed: "The request could not be completed. Check your permissions and reload.",
  reload: "Reload saved state",
  open: "Open case",
  review: "Review",
  notes: "Review message",
  notesHelp:
    "This message is visible to the buyer and is saved in the conversation and review history.",
  reviewSaved: "Review saved. No financial operation was performed.",
  independent: "Another staff member must review your own order.",
  reconcile: "Inspect recorded financial evidence",
  recommendationBlocked:
    "A refund recommendation requires a completed order, one matching recorded capture and no recorded refund or dispute. Reconcile the records first.",
  current: "Current order records",
  snapshot: "Records when the case was opened",
  changed: "The order or payment records changed after intake. Review both snapshots.",
  payments: "Payment records",
  items: "Order items",
  total: "Order total",
  requested: "Requested amount",
  captured: "Snapshot time",
  captures: "Recorded captures",
  refunded: "Recorded refunds",
  disputed: "Recorded disputes",
  history: "Review history",
  empty: "No purchase cases match these filters.",
  noPayments: "No payment records.",
  filters: "Filters",
  all: "All",
  apply: "Apply",
  clear: "Clear",
  page: "Page",
  previous: "Previous",
  next: "Next",
  thread: "Conversation",
  status: "Review status",
  order: "Order",
  date: "Created",
  buyerCases: "My purchase cases",
  invalidQuery: "Invalid filters. Clear the filters to continue.",
};
const ru: typeof en = {
  title: "Поддержка покупки",
  queue: "Обращения по покупкам",
  create: "Создать обращение по покупке",
  existing: "Продолжить существующее обращение",
  back: "К обращениям по покупкам",
  intro:
    "Одно обращение хранит всю переписку и историю разбора заказа. Продолжите или откройте его заново, если нужна дополнительная помощь.",
  financeNote:
    "Здесь показаны учётные состояния заказа и платежей, а не подтверждение от платёжного провайдера. Рекомендация возврата не переводит деньги, не меняет доступ и не регистрирует успешный возврат.",
  subject: "Тема",
  message: "Опишите проблему",
  kind: "Проблема",
  amount: "Запрошенная сумма",
  amountHelp:
    "Укажите сумму в валюте заказа, не более двух знаков после запятой. Для запроса возврата нужна положительная сумма в пределах заказа; в споре сумму можно не указывать.",
  send: "Отправить обращение",
  busy: "Сохранение…",
  saved: "Сохранено. Откройте обращение, чтобы увидеть результат.",
  uncertain:
    "Не удалось подтвердить результат. Повторите тот же запрос или загрузите сохранённое обращение перед следующим действием.",
  conflict:
    "Обращение, переписка или учётные данные изменились. Загрузите состояние заново перед разбором.",
  exists:
    "У заказа уже есть обращение. Новое сообщение не добавлено; откройте существующую переписку и продолжите её.",
  invalid: "Проверьте тему, сообщение и запрошенную сумму.",
  failed: "Не удалось выполнить запрос. Проверьте полномочия и загрузите состояние заново.",
  reload: "Загрузить сохранённое состояние",
  open: "Открыть обращение",
  review: "Разбор",
  notes: "Сообщение по результату разбора",
  notesHelp: "Покупатель увидит это сообщение. Оно сохраняется в переписке и истории разбора.",
  reviewSaved: "Результат разбора сохранён. Финансовая операция не выполнена.",
  independent: "Ваш заказ должен разобрать другой сотрудник.",
  reconcile: "Проверить учётные финансовые данные",
  recommendationBlocked:
    "Для рекомендации возврата нужен завершённый заказ, одна соответствующая запись списания и отсутствие записей возврата или спора. Сначала проверьте учётные данные.",
  current: "Текущие учётные данные заказа",
  snapshot: "Учётные данные при создании обращения",
  changed: "После создания обращения изменились данные заказа или платежей. Проверьте оба снимка.",
  payments: "Записи платежей",
  items: "Позиций заказа",
  total: "Сумма заказа",
  requested: "Запрошенная сумма",
  captured: "Время снимка",
  captures: "Записи списания",
  refunded: "Записи возврата",
  disputed: "Записи спора",
  history: "История разбора",
  empty: "Нет обращений по указанным фильтрам.",
  noPayments: "Нет записей платежей.",
  filters: "Фильтры",
  all: "Все",
  apply: "Применить",
  clear: "Сбросить",
  page: "Страница",
  previous: "Назад",
  next: "Вперёд",
  thread: "Переписка",
  status: "Состояние разбора",
  order: "Заказ",
  date: "Создано",
  buyerCases: "Мои обращения по покупкам",
  invalidQuery: "Недопустимые фильтры. Сбросьте их, чтобы продолжить.",
};
export function orderCaseCopy(locale: string) {
  return locale === "ru" ? ru : en;
}
export function orderCaseKindLabel(locale: string, value: OrderCaseKind) {
  const labels: Record<OrderCaseKind, [string, string]> = {
    payment_issue: ["Payment issue", "Проблема с оплатой"],
    resource_issue: ["Resource issue", "Проблема с ресурсом"],
    refund_request: ["Refund request", "Запрос возврата"],
    dispute: ["Dispute", "Спор"],
  };
  return labels[value][locale === "ru" ? 1 : 0];
}
export function orderCaseStatusLabel(locale: string, value: OrderCaseReviewStatus) {
  const labels: Record<OrderCaseReviewStatus, [string, string]> = {
    intake: ["Received", "Принято"],
    reviewing: ["Under review", "На разборе"],
    awaiting_buyer: ["Waiting for buyer", "Ожидает покупателя"],
    refund_recommended: ["Refund recommended; not executed", "Возврат рекомендован, не выполнен"],
    refund_declined: ["Refund request declined", "Запрос возврата отклонён"],
    resolved: ["Resolved", "Решено"],
    dismissed: ["Dismissed", "Закрыто без решения"],
  };
  return labels[value][locale === "ru" ? 1 : 0];
}
export function orderCaseActionLabel(locale: string, value: OrderCaseReview["action"]) {
  const labels: Record<OrderCaseReview["action"], [string, string]> = {
    start_review: ["Start review", "Начать разбор"],
    request_info: ["Request more information", "Запросить сведения"],
    recommend_refund: ["Recommend refund for reconciliation", "Рекомендовать возврат для сверки"],
    decline_refund: ["Decline refund request", "Отклонить запрос возврата"],
    resolve: ["Resolve case", "Завершить разбор"],
    dismiss: ["Dismiss case", "Закрыть без решения"],
    reopen: ["Reopen for review", "Открыть для повторного разбора"],
  };
  return labels[value][locale === "ru" ? 1 : 0];
}
export function orderCaseThreadLabel(locale: string, value: SupportCaseStatus) {
  return {
    open: ["Open", "Открыта"],
    resolved: ["Resolved", "Решена"],
    closed: ["Closed by staff", "Закрыта сотрудником"],
  }[value][locale === "ru" ? 1 : 0];
}
