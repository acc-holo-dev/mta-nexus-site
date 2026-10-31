import type { ReactNode } from "react";
import { ServerWorkspaceNav } from "../../../../components/server-workspace-nav";
import { getRequestLocale } from "../../../../lib/i18n-server";

export default async function ServerWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [{ id }, locale] = await Promise.all([params, getRequestLocale()]);

  return (
    <div className="space-y-6">
      <ServerWorkspaceNav serverId={id} locale={locale} />
      {children}
    </div>
  );
}
