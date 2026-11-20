import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="auth-reset-loading-heading"
      title={dictionary.recovery.resetTitle}
      loadingLabel={dictionary.recovery.checkingReset}
      className="mx-auto min-w-0 max-w-md space-y-6 overflow-x-clip py-16"
      headerClassName="space-y-2 text-center"
      rows={0}
      leading={
        <>
          <div className="h-11 rounded bg-inset" />
          <div className="h-11 rounded bg-inset" />
          <div className="h-11 rounded bg-inset" />
        </>
      }
    />
  );
}
