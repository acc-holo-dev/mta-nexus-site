import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { supportMessageCopy } from "../../../../features/support/support-message-discovery-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = supportMessageCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="support-messages-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headerClassName="space-y-3 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary"
      leading={<div className="h-10 w-full max-w-md rounded bg-inset" />}
    />
  );
}
