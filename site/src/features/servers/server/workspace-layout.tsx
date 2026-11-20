import type { ReactNode } from "react";
import { getRequestLocale } from "../../../lib/i18n/server";
import { ServerWorkspaceNav } from "../workspace-navigation";
import { pageShellStack6 } from "../../shell/page-shell";

export async function ServerWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [{ id }, locale] = await Promise.all([params, getRequestLocale()]);

  return (
    <div className={pageShellStack6}>
      <ServerWorkspaceNav serverId={id} locale={locale} />
      {children}
    </div>
  );
}
