"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/platform/i18n";
import { authEntryHref, currentBrowserReturnPath } from "../auth-return";
import { useAuthSession } from "../auth-session";
import { isShellSessionLoading, showGuestSignInCta, showWorkspaceTools } from "../session";
import { ShellSessionUnavailable } from "./shell-session-unavailable";

const linkClass =
  "rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
        <ul className="space-y-2 text-muted">
          <li>
            <Link href="/workspace/servers/new" className={linkClass}>
              {dictionary.footer.registerServer}
            </Link>
          </li>
          <li>
            <Link href="/workspace/resources/new" className={linkClass}>
              {dictionary.footer.publishResource}
            </Link>
          </li>
          <li>
            <Link href="/workspace" className={linkClass}>
              {dictionary.footer.workspace}
            </Link>
          </li>
        </ul>
      ) : showGuestSignInCta(session) ? (
        <ul className="space-y-2 text-muted">
          <li>
            <Link href={loginHref} className={linkClass}>
              {dictionary.workspace.signIn}
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
