import {
  type ContextTrustPageProps,
  contextTrustMetadata,
  PublicContextTrustPage,
} from "../../../../features/trust/public-context-trust-page";

export const dynamic = "force-dynamic";
export const generateMetadata = (props: ContextTrustPageProps) =>
  contextTrustMetadata("server", props);
export default function ServerTrustPage(props: ContextTrustPageProps) {
  return <PublicContextTrustPage {...props} kind="server" />;
}
