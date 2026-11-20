import { VerificationWorkspacePage } from "../../../features/moderation/verification-workspace-page-server";
import { verificationCopy } from "../../../features/trust/verification-workspace-copy";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: verificationCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return VerificationWorkspacePage(props);
}
