import { TrustPage, userTrustMetadata } from "../../../../features/trust/public-user-trust-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ username: string }> }) {
  return userTrustMetadata(props);
}

export default async function Page(props: { params: Promise<{ username: string }> }) {
  return TrustPage(props);
}
