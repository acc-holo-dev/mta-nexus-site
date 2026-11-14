import type { ReactNode } from "react";
import { ServerWorkspaceNav } from "../../../../features/servers/workspace-navigation";
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
    <div className="min-w-0 space-y-6 overflow-x-clip">
      <ServerWorkspaceNav serverId={id} locale={locale} />
      {children}
    </div>
  );
}
