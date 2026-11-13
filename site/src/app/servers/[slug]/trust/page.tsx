import {
  type ContextTrustPageProps,
  contextTrustMetadata,
  PublicContextTrustPage,
} from "../../../../components/public-context-trust-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = (props: ContextTrustPageProps) =>
  contextTrustMetadata("server", props);
export default function ServerTrustPage(props: ContextTrustPageProps) {
  return (
    <div className={pageShellClass}>
      <PublicContextTrustPage {...props} kind="server" />
    </div>
  );
}
