import { getDictionary, type Locale } from "../lib/i18n";
import { authEntryHref } from "./auth-return-path";
import { GuestAuthLinks } from "./guest-auth-links";

export function PlatformGuestAuthPanel({
  locale,
  returnPath,
  linkClassName,
}: {
  locale: Locale;
  returnPath: string;
  linkClassName?: string;
}) {
  const workspace = getDictionary(locale).workspace;
  return (
    <div className="nexus-panel space-y-3 p-5">
      <p className="text-sm text-secondary">{workspace.signInRequired}</p>
      {workspace.signInMessage ? (
        <p className="text-sm text-secondary">{workspace.signInMessage}</p>
      ) : null}
      <GuestAuthLinks
        loginHref={authEntryHref("login", returnPath)}
        registerHref={authEntryHref("register", returnPath)}
        signInLabel={workspace.signIn}
        createAccountLabel={workspace.createAccount}
        className={linkClassName}
      />
    </div>
  );
}
