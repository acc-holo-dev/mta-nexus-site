import { verificationApplicationsCopy } from "../../../../features/moderation/verification-applications-copy";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "verification-history-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    load: (locale) => {
      const copy = verificationApplicationsCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
