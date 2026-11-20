import { verificationApplicationsCopy } from "../../../../features/moderation/verification-applications-copy";
import { VerificationHistoryScreen } from "../../../../features/moderation/verification-history-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const copy = verificationApplicationsCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export default async function VerificationHistoryPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return VerificationHistoryScreen(props);
}
