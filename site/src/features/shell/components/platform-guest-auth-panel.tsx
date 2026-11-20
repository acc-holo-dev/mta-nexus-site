import type { Locale } from "../../../lib/i18n";
import { panelSpace3P5 } from "../panel-shell";
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
    <div className={panelSpace3P5}>
      <PlatformWorkspaceSignInCopy locale={locale} variant="panel" />
      <PlatformWorkspaceGuestAuthLinks
        locale={locale}
        returnPath={returnPath}
        linkClassName={linkClassName}
      />
    </div>
  );
}
