import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ResourcePublisherWorkspaceNav } from "../../../../components/resource-publisher-workspace-nav";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";

export default async function ResourcePublisherLayout({
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
