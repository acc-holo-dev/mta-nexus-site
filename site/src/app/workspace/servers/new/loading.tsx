import { getUserPlatformCopy } from "../../../../features/community/user-platform-copy";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../../lib/i18n";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "server-new-loading-heading",
    className: "mx-auto min-w-0 max-w-2xl space-y-5 overflow-x-clip px-4 py-8 sm:px-0",
    rows: 0,
    leading: (
      <>
        <div className="h-10 w-64 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ),
    load: (locale) => {
      const copy = getDictionary(locale).serverRegistration;
      const platform = getUserPlatformCopy(locale);
      return {
        title: copy.title,
        description: <p className="text-sm text-secondary">{copy.description}</p>,
        loading: platform.loading,
      };
    },
  });
}
