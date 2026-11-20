import { TrustPage, userTrustMetadata } from "../../../../features/trust/public-user-trust-page";

export const dynamic = "force-dynamic";

export const generateMetadata = userTrustMetadata;

export default async function Page(props: { params: Promise<{ username: string }> }) {
  return TrustPage(props);
}
