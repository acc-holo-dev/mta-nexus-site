import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
export const serverContentCopy = (locale: Locale) =>
  locale === "ru"
    ? {
        title: "Публикации сервера",
        description:
          "Владелец и действующие управляющие редактируют все материалы сервера. Новые публикации и правки статей проходят модерацию.",
        context: "Публикация сервера",
        back: "К управлению сервером",
        author: "Автор",
        new: "Создать публикацию сервера",
        uncertain:
          "Не удалось подтвердить сохранение. Проверьте публикации сервера перед повторной отправкой.",
        notice:
          "Автор и владелец получают уведомления о создании, правках, архивировании и решениях модерации, если включены уведомления о контенте. Участники без прав управления доступа не получают.",
      }
    : {
        title: "Server publications",
        description:
          "The owner and current managers edit all server publications. New publications and editorial changes require moderation.",
        context: "Publication for server",
        back: "Back to server management",
        author: "Author",
        new: "Create server publication",
        uncertain: "Could not confirm the save. Check server publications before submitting again.",
        notice:
          "The author and owner receive creation, edit, archive and moderation notices when content notifications are enabled. Members without management rights have no access.",
      };
export function serverContentMutationError(locale: Locale, code: unknown) {
  return code === "INTERNAL_ERROR" || code === "UNCONFIRMED"
    ? serverContentCopy(locale).uncertain
    : userPlatformError(locale, code);
}
