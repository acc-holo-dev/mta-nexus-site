import { can } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import { ShieldAlert } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMaxMdGuest } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";

export async function AdminSupportLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const token = (await cookies()).get("nexus_session")?.value;
  let currentUser: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    currentUser = await authService.getSession(token);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/admin/support"}
      />
    );
  }

  if (!currentUser) {
    return <PlatformSignIn locale={locale} returnPath="/admin/support" />;
  }
  if (!can(currentUser, "admin.moderation")) {
    return (
      <div className={pageShellMaxMdGuest}>
        <ErrorState
          id="admin-support-access-denied"
          title={dictionary.admin.accessDenied}
          description={dictionary.admin.accessDeniedDescription}
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.home}
            </Link>
          }
        />
      </div>
    );
  }

  return children;
}
