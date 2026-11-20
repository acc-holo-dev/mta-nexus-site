import { pageShellClip as pageShellClass } from "../../shell/page-shell";
import {
  type ContextTrustPageProps,
  contextTrustMetadata,
  PublicContextTrustPage,
} from "../../trust/public-context-trust-page";

export const generateMetadata = (props: ContextTrustPageProps) =>
  contextTrustMetadata("organization", props);
export default function OrganizationTrustPage(props: ContextTrustPageProps) {
  return (
    <div className={pageShellClass}>
      <PublicContextTrustPage {...props} kind="organization" />
    </div>
  );
}
