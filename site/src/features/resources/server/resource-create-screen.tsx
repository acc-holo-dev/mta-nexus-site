import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellClip } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { NewResourceForm } from "../create-controls";

export async function resourceCreateMetadata(): Promise<Metadata> {
  const publishing = getDictionary(await getRequestLocale()).publishing;
  const title = isWalletEngineEnabled() ? publishing.walletResourceTitle : publishing.resourceTitle;
  return {
    title: `${title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ResourceCreateScreen() {
  const locale = await getRequestLocale();
  const walletPaidPublishing = isWalletEngineEnabled();
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    const dictionary = getDictionary(locale);
    return (
      <PlatformSessionError
        locale={locale}
        title={
          walletPaidPublishing
            ? dictionary.publishing.walletResourceTitle
            : dictionary.publishing.resourceTitle
        }
        message={getUserPlatformCopy(locale).unavailable}
        retryHref="/workspace/resources/new"
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/resources/new" />;
  return (
    <div className={pageShellClip}>
      <NewResourceForm
        key={actor.id}
        actorId={actor.id}
        walletPaidPublishing={walletPaidPublishing}
      />
    </div>
  );
}
