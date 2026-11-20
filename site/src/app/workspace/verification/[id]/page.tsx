import { VerificationApplicationScreen } from "../../../../features/moderation/verification-application-server";
import { verificationApplicationsCopy } from "../../../../features/moderation/verification-applications-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: verificationApplicationsCopy(await getRequestLocale()).detail,
    robots: { index: false, follow: false },
  };
}

export default async function VerificationApplicationPage(props: {
  params: Promise<{ id: string }>;
}) {
  return VerificationApplicationScreen(props);
}
