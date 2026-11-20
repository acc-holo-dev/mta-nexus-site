import { getDictionary, type Locale } from "../../../lib/i18n";
import { authEntryHref } from "../auth-return";
import { typeDisplayPrimary, typeSmSecondary } from "../type-shell";
import { GuestAuthLinks } from "./guest-auth-links";

function workspaceGuestAuthCopy(locale: Locale) {
  return getDictionary(locale).workspace;
}

export function PlatformWorkspaceGuestAuthLinks({
  locale,
  returnPath,
  linkClassName,
}: {
  locale: Locale;
  returnPath: string | null;
  linkClassName?: string;
}) {
  const workspace = workspaceGuestAuthCopy(locale);
  return (
    <GuestAuthLinks
      loginHref={authEntryHref("login", returnPath)}
      registerHref={authEntryHref("register", returnPath)}
      signInLabel={workspace.signIn}
      createAccountLabel={workspace.createAccount}
      className={linkClassName}
    />
  );
}

export function PlatformWorkspaceSignInCopy({
  locale,
  variant,
}: {
  locale: Locale;
  variant: "page-title" | "panel";
}) {
  const { signInRequired, signInMessage } = workspaceGuestAuthCopy(locale);
  if (variant === "page-title") {
    return (
      <>
        <h1 className={typeDisplayPrimary}>{signInRequired}</h1>
        {signInMessage ? (
          <p className="mx-auto max-w-md text-sm text-secondary">{signInMessage}</p>
        ) : null}
      </>
    );
  }
  return (
    <>
      <p className={typeSmSecondary}>{signInRequired}</p>
      {signInMessage ? <p className={typeSmSecondary}>{signInMessage}</p> : null}
    </>
  );
}
