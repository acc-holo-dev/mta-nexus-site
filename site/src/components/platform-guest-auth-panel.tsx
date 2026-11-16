import type { Locale } from "../lib/i18n";
import {
  PlatformWorkspaceGuestAuthLinks,
  PlatformWorkspaceSignInCopy,
} from "./platform-workspace-guest-auth";

export function PlatformGuestAuthPanel({
  locale,
  returnPath,
  linkClassName,
}: {
  locale: Locale;
  returnPath: string;
  linkClassName?: string;
}) {
  return (
    <div className="nexus-panel space-y-3 p-5">
      <PlatformWorkspaceSignInCopy locale={locale} variant="panel" />
      <PlatformWorkspaceGuestAuthLinks
        locale={locale}
        returnPath={returnPath}
        linkClassName={linkClassName}
      />
    </div>
  );
}
