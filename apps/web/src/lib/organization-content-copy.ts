import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
export const organizationContentCopy = (locale: Locale) =>
  locale === "ru"
    ? {
        title: "Редакция организации",
        description:
          "Владелец и администраторы команды управляют всеми публикациями организации, включая материалы других авторов.",
        context: "Публикация от организации",
        back: "К организации",
        author: "Автор",
        new: "Создать публикацию организации",
        notice:
          "Автор и владелец организации получают уведомления о создании, правках, архивировании и решениях модерации, если включены уведомления о контенте.",
        uncertain:
          "Не удалось подтвердить сохранение. Проверьте публикацию в редакции перед повторной отправкой.",
      }
    : {
        title: "Organization editorial workspace",
        description:
          "The owner and team administrators manage all organization publications, including work by other authors.",
        context: "Publication for organization",
        back: "Back to organization",
        author: "Author",
        new: "Create organization publication",
        notice:
          "The author and organization owner receive creation, edit, archive and moderation notices when content notifications are enabled.",
        uncertain:
          "Could not confirm the save. Check the publication in the editorial workspace before submitting again.",
      };
export function organizationContentMutationError(locale: Locale, code: unknown) {
  return code === "INTERNAL_ERROR" || code === "UNCONFIRMED"
    ? organizationContentCopy(locale).uncertain
    : userPlatformError(locale, code);
}
