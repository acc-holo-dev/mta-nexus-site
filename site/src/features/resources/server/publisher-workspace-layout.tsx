import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { ResourcePublisherWorkspaceNav } from "../publisher-navigation";

export async function ResourcePublisherWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [{ id }, locale, actor] = await Promise.all([
    params,
    getRequestLocale(),
    cookies().then((store) => authService.getSession(store.get("nexus_session")?.value)),
  ]);

  return (
    <div className="space-y-6">
      {actor ? <ResourcePublisherWorkspaceNav resourceId={id} locale={locale} /> : null}
      {children}
    </div>
  );
}
