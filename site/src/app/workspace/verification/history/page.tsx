import {
  VerificationHistoryScreen,
  verificationHistoryMetadata,
} from "../../../../features/moderation/verification-history-server";

export const dynamic = "force-dynamic";

export const generateMetadata = verificationHistoryMetadata;

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return VerificationHistoryScreen(props);
}
