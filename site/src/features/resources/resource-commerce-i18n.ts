import type { Locale } from "../../lib/i18n";

const copy = {
  en: {
    cart: "Resource cart",
    loading: "Loading your resource cart…",
    subtitle: "Collect up to 20 free resources and add them to your library together.",
    add: "Add to cart",
    added: "In cart",
    openCart: "Open cart",
    remove: "Remove",
    removeConfirmTitle: "Remove this resource from the cart?",
    removeConfirm: "The resource stays in your library if you already claimed it.",
    cancel: "Cancel",
    acquire: "Add all to library",
    empty: "Your resource cart is empty.",
    loadUnavailable: "Your resource cart is temporarily unavailable. Please try again.",
    loadUnavailableHint:
      "Retry reloads this cart only. A temporary load failure is not an empty cart.",
    browse: "Browse resources",
    library: "Open library",
    refresh: "Refresh cart",
    unavailable: "Unavailable resource",
    itemUnavailableHint:
      "This line is withdrawn or blocked for acquisition. Remove it before confirming the cart; that is not a cart load failure.",
    unavailableNote: "Remove unavailable items before continuing.",
    unavailableNoteHint:
      "Remove unavailable lines or refresh the cart before confirming acquisition.",
    free: "Free",
    owned: "Already in your library",
    done: "Resources added to your library.",
    note: "No payment is required. Access is granted only after every selected resource passes the server checks.",
    batchIntent:
      "Batch acquire: collect free resources, then confirm the cart. Nothing is claimed until you confirm.",
    singleIntent: "Single acquire: claim this free resource for your library.",
    guestReturnNote:
      "After sign-in you return here. Cart or claim actions are not started automatically.",
    working: "Saving…",
    signIn: "Sign in to use your resource cart",
    login: "Sign in",
    lifecycle: "Publication controls",
    archive: "Archive resource",
    restore: "Restore draft",
    submit: "Submit draft for review",
    archiveNote:
      "Archiving hides this resource from the catalog and stops downloads. Files, history and existing library rights are retained.",
    restoreNote:
      "Restoring creates a draft. Previously public versions must pass moderation again before downloads resume.",
    submitNote:
      "Submit the latest clean draft or a retained published version for a new review. Rejected, retired and quarantined versions cannot be resubmitted here.",
    blocked: "This resource is suspended. Contact support to resolve the moderation restriction.",
    reason: "Reason",
    confirm: "I understand the effect of this action",
    updated: "Resource state updated.",
    actionFailedDescription:
      "A failed lifecycle action is not a changed publication state. Reload before retrying.",
    history: "Publication history",
    resourceStatus: "Resource status",
    selectedBuild: "Selected build",
    noneSelected: "None selected",
    buildUnavailableTitle: "This build is unavailable for public delivery",
    buildUnavailableDescription:
      "Download and new release watches stay blocked until a valid build is available.",
    contactSupportContext: "Contact support with this context",
    openSupportCase: "Open a support case",
    nextStatus: "Next status",
    thenSubmitReview: " → then submit for review",
    waitReviewNote: "This resource is waiting for review. It is not published automatically.",
    restoreDraftWarning: "Restore returns a draft. It does not republish the resource.",
    restoreDraftSaved: " Draft is ready for review; nothing was auto-published.",
    errors: {
      RESOURCE_CART_FULL: "The cart holds at most 20 resources. Remove an item first.",
      RESOURCE_CART_CHANGED:
        "The cart changed in another tab. Refresh and review it before continuing.",
      RESOURCE_CART_REQUEST_CONFLICT:
        "This request no longer matches your selection. Refresh the cart.",
      RESOURCE_UNAVAILABLE: "This resource is no longer available. Refresh the cart.",
      NOT_FOUND: "The resource is unavailable or you no longer have access.",
      VALIDATION_FAILED:
        "A selected resource cannot be acquired. Refresh the cart and remove unavailable items.",
      VALIDATION_ERROR:
        "A selected resource cannot be acquired. Refresh the cart and remove unavailable items.",
      UNAUTHORIZED: "Your session expired. Sign in and try again.",
      ACTOR_ID_REQUIRED: "Reload this page and confirm your account before continuing.",
      ACTOR_CHANGED: "The signed-in account changed. Reload before continuing.",
      FORBIDDEN: "You do not have permission to perform this action.",
      CONFLICT: "The resource changed. Reload the page and review the current state.",
      RATE_LIMIT_EXCEEDED: "Too many operations. Wait a little and try again.",
      RATE_LIMITED: "Too many operations. Wait a little and try again.",
      PRODUCT_METADATA_REVISION_REQUIRED:
        "Reload the resource before saving; an observed revision is required.",
      PRODUCT_METADATA_CONFLICT:
        "The resource changed. Reload the page and review the current state.",
      PRODUCT_STATE_CHANGED:
        "This action is not allowed in the current resource state. Reload the page.",
      RESOURCE_REVIEW_BUILD_REQUIRED:
        "Upload a version with a trusted clean scan before submitting the draft.",
      RESOURCE_LIFECYCLE_INVALID: "Enter a reason of 5–1000 characters and confirm the action.",
      fallback: "The operation was not confirmed. Retry or refresh to check the current state.",
      formErrorHint:
        "No cart or acquisition change was recorded. Retry the same request or refresh the cart state.",
    },
  },
  ru: {
    cart: "Корзина ресурсов",
    loading: "Загрузка корзины ресурсов…",
    subtitle: "Соберите до 20 бесплатных ресурсов и добавьте их в библиотеку вместе.",
    add: "В корзину",
    added: "В корзине",
    openCart: "Открыть корзину",
    remove: "Убрать",
    removeConfirmTitle: "Убрать этот ресурс из корзины?",
    removeConfirm: "Если ресурс уже в библиотеке, он там и останется.",
    cancel: "Отмена",
    acquire: "Добавить всё в библиотеку",
    empty: "Корзина ресурсов пуста.",
    loadUnavailable: "Корзина ресурсов временно недоступна. Попробуйте ещё раз.",
    loadUnavailableHint:
      "Повтор обновляет только эту корзину. Временный сбой загрузки — не пустая корзина.",
    browse: "Выбрать ресурсы",
    library: "Открыть библиотеку",
    refresh: "Обновить корзину",
    unavailable: "Недоступный ресурс",
    itemUnavailableHint:
      "Эта строка снята с получения или заблокирована. Уберите её перед подтверждением корзины — это не сбой загрузки корзины.",
    unavailableNote: "Уберите недоступные ресурсы, чтобы продолжить.",
    unavailableNoteHint:
      "Уберите недоступные строки или обновите корзину перед подтверждением получения.",
    free: "Бесплатно",
    owned: "Уже в библиотеке",
    done: "Ресурсы добавлены в библиотеку.",
    note: "Оплата не требуется. Права выдаются после проверки каждого выбранного ресурса на сервере.",
    batchIntent:
      "Пакетное получение: соберите бесплатные ресурсы, затем подтвердите корзину. Без подтверждения claim не выполняется.",
    singleIntent: "Одиночное получение: добавить этот бесплатный ресурс в библиотеку.",
    guestReturnNote: "После входа вы вернётесь сюда. Корзина или claim сами не запускаются.",
    working: "Сохранение…",
    signIn: "Войдите, чтобы пользоваться корзиной ресурсов",
    login: "Войти",
    lifecycle: "Управление публикацией",
    archive: "Архивировать ресурс",
    restore: "Вернуть в черновики",
    submit: "Отправить черновик на модерацию",
    archiveNote:
      "Архивирование скрывает ресурс из каталога и останавливает скачивание. Файлы, история и существующие права в библиотеке сохраняются.",
    restoreNote:
      "Ресурс вернётся в черновики. Ранее опубликованные версии должны пройти модерацию заново, прежде чем скачивание возобновится.",
    submitNote:
      "Отправьте последнюю чистую версию черновика или сохранённую опубликованную версию на новую проверку. Отклонённые, отозванные и карантинные версии нельзя отправить повторно здесь.",
    blocked: "Ресурс заблокирован модерацией. Обратитесь в поддержку для снятия ограничения.",
    reason: "Причина",
    confirm: "Я понимаю последствия этого действия",
    updated: "Состояние ресурса обновлено.",
    actionFailedDescription:
      "Неуспешное действие жизненного цикла не меняет состояние публикации. Обновите страницу перед повтором.",
    history: "История публикации",
    resourceStatus: "Статус ресурса",
    selectedBuild: "Выбранная сборка",
    noneSelected: "Не выбрана",
    buildUnavailableTitle: "Эта сборка недоступна для публичной выдачи",
    buildUnavailableDescription:
      "Скачивание и новая подписка на релизы блокируются, пока сборка снова не станет допустимой.",
    contactSupportContext: "Обратиться в поддержку с этим контекстом",
    openSupportCase: "Открыть обращение",
    nextStatus: "Следующее состояние",
    thenSubmitReview: " → затем отправка на проверку",
    waitReviewNote: "Ресурс ожидает проверки. Публикация не происходит автоматически.",
    restoreDraftWarning:
      "После восстановления ресурс станет черновиком, а не снова опубликованным.",
    restoreDraftSaved: " Черновик готов к проверке; автоматической публикации нет.",
    errors: {
      RESOURCE_CART_FULL: "В корзине может быть до 20 ресурсов. Сначала уберите один из них.",
      RESOURCE_CART_CHANGED:
        "Корзина изменилась в другой вкладке. Обновите и проверьте её перед продолжением.",
      RESOURCE_CART_REQUEST_CONFLICT:
        "Запрос больше не соответствует выбранным ресурсам. Обновите корзину.",
      RESOURCE_UNAVAILABLE: "Ресурс больше недоступен. Обновите корзину.",
      NOT_FOUND: "Ресурс недоступен или у вас больше нет прав на него.",
      VALIDATION_FAILED:
        "Один из ресурсов нельзя получить. Обновите корзину и уберите недоступные позиции.",
      VALIDATION_ERROR:
        "Один из ресурсов нельзя получить. Обновите корзину и уберите недоступные позиции.",
      UNAUTHORIZED: "Сессия истекла. Войдите и повторите попытку.",
      ACTOR_ID_REQUIRED: "Обновите страницу и подтвердите аккаунт перед продолжением.",
      ACTOR_CHANGED: "Вошедший аккаунт изменился. Обновите страницу перед продолжением.",
      FORBIDDEN: "У вас нет прав на это действие.",
      CONFLICT: "Ресурс изменился. Перезагрузите страницу и проверьте текущее состояние.",
      RATE_LIMIT_EXCEEDED: "Слишком много операций. Подождите немного и повторите попытку.",
      RATE_LIMITED: "Слишком много операций. Подождите немного и повторите попытку.",
      PRODUCT_METADATA_REVISION_REQUIRED:
        "Обновите ресурс перед сохранением: требуется прочитанная ревизия.",
      PRODUCT_METADATA_CONFLICT:
        "Ресурс изменился. Перезагрузите страницу и проверьте текущее состояние.",
      PRODUCT_STATE_CHANGED:
        "Действие недоступно в текущем состоянии ресурса. Перезагрузите страницу.",
      RESOURCE_REVIEW_BUILD_REQUIRED:
        "Загрузите версию с подтверждённой чистой проверкой перед отправкой черновика.",
      RESOURCE_LIFECYCLE_INVALID: "Укажите причину длиной 5–1000 символов и подтвердите действие.",
      fallback:
        "Операция не подтверждена. Повторите запрос или обновите страницу, чтобы проверить состояние.",
      formErrorHint:
        "Корзина или получение не изменялись. Повторите тот же запрос или обновите состояние корзины.",
    },
  },
};

export function getResourceCommerceCopy(locale: Locale) {
  return copy[locale];
}
export function resourceCommerceError(locale: Locale, code: unknown) {
  const errors = copy[locale].errors;
  return typeof code === "string" && Object.hasOwn(errors, code)
    ? errors[code as keyof typeof errors]
    : errors.fallback;
}
