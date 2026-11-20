import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="auth-verify-email-loading-heading"
      title={dictionary.recovery.verifyTitle}
      loadingLabel={dictionary.recovery.checkingVerification}
      className="mx-auto min-w-0 max-w-md space-y-6 overflow-x-clip py-16"
      headerClassName="space-y-2 text-center"
      rows={0}
      leading={
        <>
          <div className="h-28 rounded bg-inset" />
          <div className="h-11 w-40 rounded bg-inset" />
        </>
      }
    />
  );
}
