import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { parseAuthReturnPath } from "../../shell/auth-return";
import { pageShellClip } from "../../shell/page-shell";
import { AuthForm } from "../components/auth-form";

export async function registerMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).auth.registerTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function RegisterScreen({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [locale, params] = await Promise.all([getRequestLocale(), searchParams]);
  const nextRaw =
    typeof params.next === "string"
      ? params.next
      : Array.isArray(params.next)
        ? params.next[0]
        : undefined;
  const initialReturnPath = parseAuthReturnPath(nextRaw);
  return (
    <div className={pageShellClip}>
      <AuthForm
        mode="register"
        locale={locale}
        initialReturnPath={initialReturnPath}
        walletEnabled={isWalletEngineEnabled()}
      />
    </div>
  );
}
