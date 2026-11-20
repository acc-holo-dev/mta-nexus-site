import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { getManagedServerCopy } from "../managed-server-view";
import { RegisterServerForm } from "../registration";

const pageShellClass = "mx-auto min-w-0 max-w-2xl space-y-5 overflow-x-clip px-4 py-8 sm:px-0";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
      <Link href="/workspace/servers" className={navLinkClass}>
        ← {copy.title}
      </Link>
      <RegisterServerForm key={actor.id} actorId={actor.id} />
    </div>
  );
}
