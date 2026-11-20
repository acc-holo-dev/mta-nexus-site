import {
  VerificationWorkspacePage,
  verificationWorkspaceMetadata,
} from "../../../features/moderation/verification-workspace-page-server";

export const dynamic = "force-dynamic";

export const generateMetadata = verificationWorkspaceMetadata;

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return VerificationWorkspacePage(props);
}
