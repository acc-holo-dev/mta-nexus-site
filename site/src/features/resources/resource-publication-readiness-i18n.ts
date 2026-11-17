import type {
  ResourcePublicationReadinessItem,
  ResourcePublicationReadinessItemId,
  ResourcePublicationReadinessItemState,
  ResourcePublicationReadinessSummary,
} from "@nexus/domain";

const copy = {
  en: {
    title: "Publication readiness",
    overview: "Overview",
    required: "Required",
    recommendation: "Recommendation",
    previewNote:
      "Market preview shows draft or published metadata only. It does not publish the resource or replace malware scanning.",
    checklistNote:
      "Completed checklist items do not replace a provenance-backed clean scan. Public delivery still requires scanner id and scan time.",
    fix: "Open fix",
    openPreview: "Open preview",
    items: {
      description: "Description",
      media: "Gallery media",
      build: "Version file",
      scan: "Malware scan",
      moderation: "Review and publication",
      compatibility: "Compatibility metadata",
    } satisfies Record<ResourcePublicationReadinessItemId, string>,
    states: {
      complete: "Ready",
      blocked: "Blocked",
      pending: "In progress",
      not_applicable: "Not applicable",
    } satisfies Record<ResourcePublicationReadinessItemState, string>,
    details: {
      description: {
        complete: "Title and description meet save requirements.",
        incomplete: "Add a title (3+ characters) and description (10+ characters), then save.",
      },
      media: {
        present: "Gallery images are attached.",
        empty: "Optional gallery images help buyers understand the resource.",
      },
      build: {
        present: "At least one version file exists.",
        missing: "Upload a version archive on this resource.",
      },
      scan: {
        clean: "Latest eligible version has a provenance-backed clean scan.",
        awaiting: "Wait for the malware scan to finish with scanner id and time recorded.",
        malicious: "Scan reported malware. Upload a safe replacement version.",
        error: "Scan failed. Review the build workspace and upload again if needed.",
        missing_build: "Upload a version before scanning can run.",
      },
      moderation: {
        archived: "Resource is archived. Restore the draft before submitting again.",
        suspended: "Resource is suspended. Resolve the restriction or contact support.",
        in_review: "Moderators are reviewing the submitted version.",
        metadata_review: "Card changes require editorial review before the catalog updates.",
        published: "Resource is published with a safe release.",
        build_rejected: "The latest review rejected a version. Read moderation notes and resubmit.",
        awaiting_submit: "Submit a clean saved version for moderator review.",
        not_submitted: "Finish required steps, then submit from publication controls.",
        draft: "Not yet submitted for review.",
      },
      compatibility: {
        present: "Compatibility or dependency hints are saved.",
        optional: "Compatibility metadata is optional and does not block submission.",
      },
    },
  },
  ru: {
    title: "Готовность к публикации",
    overview: "Сводка",
    required: "Обязательно",
    recommendation: "Рекомендация",
    previewNote:
      "Превью в каталоге показывает черновик или опубликованные данные. Оно не публикует ресурс и не заменяет проверку на malware.",
    checklistNote:
      "Отмеченные пункты не заменяют чистый результат сканера с id и временем. Публичная выдача по-прежнему требует подтверждённого скана.",
    fix: "Исправить",
    openPreview: "Открыть превью",
    items: {
      description: "Описание",
      media: "Галерея",
      build: "Файл версии",
      scan: "Проверка на malware",
      moderation: "Модерация и публикация",
      compatibility: "Совместимость",
    },
    states: {
      complete: "Готово",
      blocked: "Блокирует",
      pending: "В процессе",
      not_applicable: "Не требуется",
    },
    details: {
      description: {
        complete: "Название и описание соответствуют требованиям сохранения.",
        incomplete: "Добавьте название (от 3 символов) и описание (от 10), затем сохраните.",
      },
      media: {
        present: "В галерее есть изображения.",
        empty: "Галерея необязательна, но помогает покупателям понять ресурс.",
      },
      build: {
        present: "Загружена хотя бы одна версия.",
        missing: "Загрузите архив версии на этой странице.",
      },
      scan: {
        clean: "Подходящая версия прошла чистую проверку с id сканера и временем.",
        awaiting: "Дождитесь завершения сканирования с id сканера и временем.",
        malicious: "Сканер обнаружил malware. Загрузите безопасную версию.",
        error:
          "Сканирование завершилось ошибкой. Проверьте сборку и при необходимости загрузите снова.",
        missing_build: "Сначала загрузите версию, чтобы запустить сканирование.",
      },
      moderation: {
        archived: "Ресурс в архиве. Восстановите черновик перед повторной отправкой.",
        suspended: "Ресурс заблокирован. Снимите ограничение или обратитесь в поддержку.",
        in_review: "Модераторы проверяют отправленную версию.",
        metadata_review: "Изменения карточки требуют повторной проверки перед каталогом.",
        published: "Ресурс опубликован с безопасной версией.",
        build_rejected:
          "Последняя проверка отклонила версию. Прочитайте заметки модерации и отправьте снова.",
        awaiting_submit: "Отправьте сохранённую чистую версию на проверку.",
        not_submitted: "Завершите обязательные шаги и отправьте ресурс из блока публикации.",
        draft: "Ресурс ещё не отправлен на проверку.",
      },
      compatibility: {
        present: "Подсказки по совместимости или зависимостям сохранены.",
        optional: "Метаданные совместимости необязательны и не блокируют отправку.",
      },
    },
  },
} as const;

type Locale = keyof typeof copy;

export function getResourcePublicationReadinessCopy(locale: Locale) {
  return copy[locale];
}

export function publicationReadinessDetail(
  locale: Locale,
  item: ResourcePublicationReadinessItem,
): string {
  const table = copy[locale].details[item.id] as Record<string, string>;
  return table[item.detailKey] ?? item.detailKey;
}

export function publicationReadinessOverview(
  _locale: Locale,
  summary: ResourcePublicationReadinessSummary,
  publisherReadiness: Record<ResourcePublicationReadinessSummary["inventoryReadiness"], string>,
): string {
  return publisherReadiness[summary.inventoryReadiness];
}
