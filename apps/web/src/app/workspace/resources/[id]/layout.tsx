import type { ReactNode } from "react";
import { ResourcePublisherWorkspaceNav } from "../../../../components/resource-publisher-workspace-nav";
import { getRequestLocale } from "../../../../lib/i18n-server";

export default async function ResourcePublisherLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [{ id }, locale] = await Promise.all([params, getRequestLocale()]);

  return (
    <div className="space-y-6">
      <ResourcePublisherWorkspaceNav resourceId={id} locale={locale} />
      {children}
    </div>
  );
}
