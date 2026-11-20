import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { parseAuthReturnPath } from "../../shell/auth-return";
import { pageShellClip as pageShellClass } from "../../shell/page-shell";
import { AuthForm } from "../components/auth-form";

export async function loginMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).auth.loginTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LoginScreen({
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
    <div className={pageShellClass}>
      <AuthForm mode="login" locale={locale} initialReturnPath={initialReturnPath} />
    </div>
  );
}
