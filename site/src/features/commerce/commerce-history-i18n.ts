/** Read-only open free-beta legacy history wording, independent of paid checkout. */
export const commerceHistoryCopy = {
  en: {
    navigation: "Account history",
    tabs: { purchases: "Purchases", licenses: "Licenses", sales: "Sales" },
    signInRequired: "Sign in to view your private history",
    signIn: "Sign in",
    back: "Back to workspace",
    betaNotice:
      "Existing records only. Paid checkout, payouts, invoices, new licenses and paid renewals are not available in this open free beta.",
    walletBetaNotice:
      "Existing records only. Site-wallet purchase and settlement can run when the wallet engine is on. Card checkout, live payouts, invoices, and paid renewals stay off until those surfaces are enabled.",
    page: "Page",
    of: "of",
    previous: "Previous",
    next: "Next",
    purchasesTitle: "Purchase history",
    purchasesDescription:
      "Orders already stored for your account. No new payments can be made here.",
    emptyPurchases: "No historical purchases for this account.",
    emptyPurchasesHint:
      "Historical purchases appear here after an order is stored for your account. An empty list is not a load failure.",
    orderNumber: "Order",
    orderDetailsTitle: "Order details",
    details: "View order details",
    backToPurchases: "Back to purchase history",
    lineItems: "Historical order items",
    emptyItems: "No line items are stored for this order.",
    emptyItemsHint:
      "Line items appear when they were stored with this order. Missing items do not confirm payment or access.",
    unavailableResource: "Resource currently unavailable",
    accessReady: "Current download access is available",
    accessMissing: "No current download access",
    openResource: "Open resource",
    linePrice: "Historical line price",
    receiptNote:
      "The stored order state and amount do not activate access or confirm a new payment. Resource details reflect current visibility and access; withdrawn resources are hidden.",
    walletReceiptNote:
      "This order has a completed site-wallet settlement recorded in the ledger. That is an audited wallet debit, not card checkout or an external PSP capture. Purchased build evidence below is recorded metadata only — it does not pin download selection.",
    purchasedBuildEvidence: "Recorded purchased build",
    purchasedBuildEvidenceHint:
      "Evidence from wallet settle metadata. Download still follows current library selection or latest published build.",
    status: "Status",
    placed: "Placed",
    total: "Order total",
    purchasesLoadUnavailable:
      "Purchase history is temporarily unavailable. This does not mean you have no purchases.",
    purchasesLoadUnavailableHint:
      "Retry keeps the same page. A temporary load failure is not a cancelled order or payment.",
    orderLoadUnavailable:
      "This order is temporarily unavailable. This does not mean the purchase was cancelled.",
    orderLoadUnavailableHint:
      "Retry reloads the same order receipt. A temporary failure does not change access or payment state.",
    licensesTitle: "License history",
    licensesDescription:
      "Older license records, shown without keys or sensitive server identifiers.",
    emptyLicenses: "No historical licenses for this account.",
    emptyLicensesFiltered: "No licenses match these filters.",
    loadUnavailable: "License history is temporarily unavailable. Please try again.",
    loadUnavailableHint:
      "Retry reloads this license history only. A temporary load failure is not an empty license archive.",
    licenseNotice:
      "A historical license entry is not a guarantee of active download or server access. Current access is checked separately.",
    resource: "Resource",
    model: "Model",
    issued: "Issued",
    expires: "Expires",
    never: "No expiry recorded",
    binding: "Server binding",
    bound: "Bound",
    unbound: "Not bound",
    salesTitle: "Sales history",
    salesDescription: "Completed historical line items for resources authored by this account.",
    emptySales: "No completed historical sales for your resources.",
    emptySalesHint:
      "Completed historical sales appear here after a buyer order stores a line for your resource. An empty list is not a load failure or payout status.",
    salesLoadUnavailable:
      "Sales history is temporarily unavailable. This does not mean you have no sales.",
    salesLoadUnavailableHint:
      "Retry keeps the same page. A temporary load failure is not a cancelled sale or payout authorization.",
    loading: "Loading history…",
    grossNotice:
      "Amounts below are historical gross line prices, not your withdrawable balance, fees, earnings or payout authorization.",
    walletGrossNotice:
      "Amounts below are historical gross line prices. Seller proceeds from site-wallet sales sit in escrow held balance for 7 days before release into available site-wallet balance. This list is not a payout authorization.",
    grossPrice: "Gross line price",
    saleLineEstimate:
      "About {amount} at the recorded rate. The stored gross line stays {base}. This does not move money.",
    saleLineEstimateNone: "No recorded rate from {base} to {quote}.",
    saleLineEstimateDust:
      "The recorded rate from {base} to {quote} is too small to show a whole unit.",
    saleLineEstimateInvalid: "The recorded rate from {base} to {quote} cannot be shown.",
    saleLineEstimateUnavailable:
      "Recorded rates could not be loaded. The stored gross line is unchanged.",
    orderStatuses: {
      pending: "Pending",
      processing: "Processing",
      completed: "Completed",
      cancelled: "Cancelled",
      refunded: "Refunded",
    },
    licenseStatuses: {
      active: "Active",
      expired: "Expired",
      revoked: "Revoked",
      suspended: "Suspended",
    },
  },
  ru: {
    navigation: "История аккаунта",
    tabs: { purchases: "Покупки", licenses: "Лицензии", sales: "Продажи" },
    signInRequired: "Войдите, чтобы посмотреть свою историю",
    signIn: "Войти",
    back: "Вернуться в кабинет",
    betaNotice:
      "Только существующие данные. Оплата, вывод средств, счета, новые лицензии и платное продление пока недоступны в открытой бесплатной бете.",
    walletBetaNotice:
      "Только существующие данные. Покупка и расчёт через site wallet доступны, когда движок кошелька включён. Карточный checkout, live-выплаты, счета и платное продление остаются выключенными, пока эти поверхности не включены.",
    page: "Страница",
    of: "из",
    previous: "Назад",
    next: "Далее",
    purchasesTitle: "История покупок",
    purchasesDescription:
      "Ранее сохранённые заказы вашего аккаунта. Совершить новый платёж здесь нельзя.",
    emptyPurchases: "У этого аккаунта нет сохранённых покупок.",
    emptyPurchasesHint:
      "Исторические покупки появляются здесь после сохранения заказа для аккаунта. Пустой список — это не сбой загрузки.",
    orderNumber: "Заказ",
    orderDetailsTitle: "Состав заказа",
    details: "Посмотреть состав заказа",
    backToPurchases: "Вернуться к истории покупок",
    lineItems: "Сохранённые позиции заказа",
    emptyItems: "У этого заказа нет сохранённых позиций.",
    emptyItemsHint:
      "Позиции появляются, если они были сохранены с этим заказом. Их отсутствие не подтверждает оплату или доступ.",
    unavailableResource: "Ресурс сейчас недоступен",
    accessReady: "Есть действующий доступ к скачиванию",
    accessMissing: "Действующего доступа к скачиванию нет",
    openResource: "Открыть ресурс",
    linePrice: "Сохранённая цена позиции",
    receiptNote:
      "Сохранённые состояние и сумма заказа не выдают права и не подтверждают новый платёж. Данные ресурсов учитывают их текущую видимость и права доступа; снятые с публикации ресурсы скрыты.",
    walletReceiptNote:
      "По этому заказу записан completed расчёт через site wallet в ledger. Это аудируемое списание с кошелька, а не карточный checkout и не внешний PSP capture. Сведения о купленной сборке ниже — только metadata evidence; они не закрепляют выбор скачивания.",
    purchasedBuildEvidence: "Зафиксированная купленная сборка",
    purchasedBuildEvidenceHint:
      "Evidence из metadata wallet settle. Скачивание по-прежнему следует текущему выбору в библиотеке или последней опубликованной сборке.",
    status: "Статус",
    placed: "Оформлен",
    total: "Сумма заказа",
    purchasesLoadUnavailable:
      "История покупок временно недоступна. Это не означает, что покупок нет.",
    purchasesLoadUnavailableHint:
      "Повтор сохраняет ту же страницу. Временный сбой загрузки — это не отмена заказа или платежа.",
    orderLoadUnavailable: "Этот заказ временно недоступен. Это не означает, что покупка отменена.",
    orderLoadUnavailableHint:
      "Повтор загружает ту же квитанцию заказа. Временный сбой не меняет доступ и состояние платежа.",
    licensesTitle: "История лицензий",
    licensesDescription: "Ранее выданные лицензии без ключей и приватных идентификаторов серверов.",
    emptyLicenses: "У этого аккаунта нет сохранённых лицензий.",
    emptyLicensesFiltered: "Нет лицензий с выбранными фильтрами.",
    loadUnavailable: "История лицензий временно недоступна. Попробуйте ещё раз.",
    loadUnavailableHint:
      "Повтор обновляет только эту историю лицензий. Временный сбой загрузки — не пустой архив лицензий.",
    licenseNotice:
      "Историческая запись о лицензии не гарантирует доступ к скачиванию или серверу. Актуальные права проверяются отдельно.",
    resource: "Ресурс",
    model: "Модель",
    issued: "Выдана",
    expires: "Истекает",
    never: "Срок не указан",
    binding: "Привязка к серверу",
    bound: "Привязана",
    unbound: "Не привязана",
    salesTitle: "История продаж",
    salesDescription:
      "Ранее завершённые операции по ресурсам, автором которых является ваш аккаунт.",
    emptySales: "Завершённые продажи ваших ресурсов не найдены.",
    emptySalesHint:
      "Завершённые продажи появляются здесь после сохранения позиции заказа покупателя по вашему ресурсу. Пустой список — это не сбой загрузки и не статус выплаты.",
    salesLoadUnavailable: "История продаж временно недоступна. Это не означает, что продаж нет.",
    salesLoadUnavailableHint:
      "Повтор сохраняет ту же страницу. Временный сбой загрузки — это не отмена продажи и не разрешение на выплату.",
    loading: "Загрузка истории…",
    grossNotice:
      "Показана полная цена позиции заказа, а не доступный к выводу баланс, прибыль, комиссия или разрешение на выплату.",
    walletGrossNotice:
      "Показана полная цена позиции заказа. Поступления продавца от продаж через site wallet держатся в escrow (held) 7 дней, затем попадают в available баланс site wallet. Этот список не является разрешением на выплату.",
    grossPrice: "Цена позиции",
    saleLineEstimate:
      "Примерно {amount} по записанному курсу. Сохранённая цена позиции остаётся в {base}. Деньги не перемещаются.",
    saleLineEstimateNone: "Записанного курса из {base} в {quote} нет.",
    saleLineEstimateDust:
      "Записанный курс из {base} в {quote} слишком мал, чтобы показать целую единицу.",
    saleLineEstimateInvalid: "Записанный курс из {base} в {quote} нельзя показать.",
    saleLineEstimateUnavailable:
      "Записанные курсы не загрузились. Сохранённая цена позиции не изменилась.",
    orderStatuses: {
      pending: "Ожидает",
      processing: "Обрабатывается",
      completed: "Завершён",
      cancelled: "Отменён",
      refunded: "Возвращён",
    },
    licenseStatuses: {
      active: "Активна",
      expired: "Истекла",
      revoked: "Отозвана",
      suspended: "Приостановлена",
    },
  },
} as const;

export function getCommerceHistoryCopy(locale: "en" | "ru") {
  return commerceHistoryCopy[locale];
}

export function commerceHistoryBetaNotice(locale: "en" | "ru", walletEnabled: boolean): string {
  const copy = commerceHistoryCopy[locale];
  return walletEnabled ? copy.walletBetaNotice : copy.betaNotice;
}
