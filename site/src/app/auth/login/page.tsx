import type { Metadata } from "next";
import { AuthForm } from "../../../features/accounts/auth";
import { parseAuthReturnPath } from "../../../features/shell/auth-return";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).auth.loginTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
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
