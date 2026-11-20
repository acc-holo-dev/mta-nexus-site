import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax2xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { getManagedServerCopy } from "../managed-server-view";
import { RegisterServerForm } from "../registration";

import { linkAccentSm } from "../../shell/link-shell";
export async function registerServerMetadata(): Promise<Metadata> {
  const copy = getDictionary(await getRequestLocale()).serverRegistration;
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export async function RegisterServerScreen() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/workspace/servers/new"}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/servers/new" />;
  const copy = getManagedServerCopy(locale);
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/servers" className={linkAccentSm}>
        ← {copy.title}
      </Link>
      <RegisterServerForm key={actor.id} actorId={actor.id} />
    </div>
  );
}
