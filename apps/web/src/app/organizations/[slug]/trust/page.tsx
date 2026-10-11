import {
  PublicContextTrustPage,
  contextTrustMetadata,
  type ContextTrustPageProps,
} from "../../../../components/public-context-trust-page";
export const dynamic = "force-dynamic";
export const generateMetadata = (props: ContextTrustPageProps) =>
  contextTrustMetadata("organization", props);
export default function OrganizationTrustPage(props: ContextTrustPageProps) {
  return <PublicContextTrustPage {...props} kind="organization" />;
}
