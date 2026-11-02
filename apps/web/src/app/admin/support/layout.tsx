import { can } from "@nexus/security";
import { ShieldAlert } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";

export const dynamic = "force-dynamic";

export default async function AdminSupportLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const token = (await cookies()).get("nexus_session")?.value;
  const currentUser = await authService.getSession(token);

  if (!currentUser) {
    return <PlatformSignIn locale={locale} returnPath="/admin/support" />;
  }
  if (!can(currentUser, "admin.moderation")) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="font-display text-primary">{dictionary.admin.accessDenied}</h1>
        <p className="font-caption text-muted">{dictionary.admin.accessDeniedDescription}</p>
        <Link
          href="/"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {dictionary.errors.home}
        </Link>
      </div>
    );
  }

  return children;
}
