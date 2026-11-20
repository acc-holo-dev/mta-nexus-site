import {
  VerificationApplicationScreen,
  verificationApplicationMetadata,
} from "../../../../features/moderation/verification-application-server";

export const dynamic = "force-dynamic";

export const generateMetadata = verificationApplicationMetadata;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return VerificationApplicationScreen(props);
}
