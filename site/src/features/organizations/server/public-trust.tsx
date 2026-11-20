import { pageShellClip as pageShellClass } from "../../shell/page-shell";
import {
  type ContextTrustPageProps,
  contextTrustMetadata,
  PublicContextTrustPage,
} from "../../trust/public-context-trust-page";

export const organizationTrustMetadata = (props: ContextTrustPageProps) =>
  contextTrustMetadata("organization", props);
export function OrganizationTrustPage(props: ContextTrustPageProps) {
  return (
    <div className={pageShellClass}>
      <PublicContextTrustPage {...props} kind="organization" />
    </div>
  );
}
