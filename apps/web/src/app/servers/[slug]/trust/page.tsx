import {
  PublicContextTrustPage,
  contextTrustMetadata,
  type ContextTrustPageProps,
} from "../../../../components/public-context-trust-page";
export const dynamic = "force-dynamic";
export const generateMetadata = (props: ContextTrustPageProps) =>
  contextTrustMetadata("server", props);
export default function ServerTrustPage(props: ContextTrustPageProps) {
  return <PublicContextTrustPage {...props} kind="server" />;
}
