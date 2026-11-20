"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { authEntryHref, currentBrowserReturnPath } from "../auth-return";
import { useAuthSession } from "../auth-session";
import { isShellSessionLoading, showGuestSignInCta, showWorkspaceTools } from "../session";
import { typeFooterNavLink, typeSpace2Muted } from "../type-shell";
import { ShellSessionUnavailable } from "./shell-session-unavailable";

/** UX-23: workspace contribute links only after a confirmed member session. */
export function FooterContribute({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const session = useAuthSession();
  const pathname = usePathname();
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));

  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh login return path after client navigation.
  useEffect(() => {
    setLoginHref(authEntryHref("login", currentBrowserReturnPath()));
  }, [pathname]);

  return (
    <div>
      <h4 className="mb-3 font-label uppercase text-primary">{dictionary.footer.contribute}</h4>
      {isShellSessionLoading(session) ? (
        <p role="status" className="text-muted">
          {dictionary.nav.checkingSession}
        </p>
      ) : session.status === "unavailable" ? (
        <ShellSessionUnavailable locale={locale} retry={session.retry} />
      ) : showWorkspaceTools(session) ? (
        <ul className={typeSpace2Muted}>
          <li>
            <Link href="/workspace/servers/new" className={typeFooterNavLink}>
              {dictionary.footer.registerServer}
            </Link>
          </li>
          <li>
            <Link href="/workspace/resources/new" className={typeFooterNavLink}>
              {dictionary.footer.publishResource}
            </Link>
          </li>
          <li>
            <Link href="/workspace" className={typeFooterNavLink}>
              {dictionary.footer.workspace}
            </Link>
          </li>
        </ul>
      ) : showGuestSignInCta(session) ? (
        <ul className={typeSpace2Muted}>
          <li>
            <Link href={loginHref} className={typeFooterNavLink}>
              {dictionary.workspace.signIn}
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
