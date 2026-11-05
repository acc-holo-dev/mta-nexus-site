import { readManagedServerClaimStatus } from "@nexus/db";
import { Server } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { ServerClaimStatusPanel } from "../../../../components/server-claim-status-panel";
import { ServerDetailsForm } from "../../../../components/server-details-form";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getManagedServerCopy } from "../../../../lib/managed-server-view";
import { authService } from "../../../../lib/services/auth-service";
import { serverService } from "../../../../lib/services/server-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Server management | MTA NEXUS",
  robots: { index: false, follow: false },
};

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default async function ServerManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).serverManagement;
  const serverCopy = getManagedServerCopy(locale);
  const token = (await cookies()).get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <PlatformSignIn locale={locale} returnPath={`/workspace/servers/${encodeURIComponent(id)}`} />
    );
  }

  const server = await serverService.getServerById(id);
  if (!server) notFound();
  if (!(await serverService.canManageServer(server, user))) notFound();
  const claimStatus = await readManagedServerClaimStatus(server.id, user);
  if (!claimStatus) notFound();

  return (
    <div className={pageShellClass}>
      <div className="min-w-0">
        <Link href="/workspace/servers" className={navLinkClass}>
          ← {serverCopy.title}
        </Link>
        <h1 className="mt-2 break-words text-2xl font-black text-primary">{server.name}</h1>
        <p className="mt-1 font-mono text-sm text-muted">
          {server.ipAddress}:{server.port}
        </p>
      </div>

      <div className="nexus-panel flex items-start gap-3 p-4">
        <Server className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-primary">{copy.ownerManaged}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{copy.ownerManagedDescription}</p>
        </div>
      </div>

      <ServerClaimStatusPanel
        serverId={server.id}
        serverName={server.name}
        actorId={user.id}
        status={claimStatus}
        locale={locale}
      />

      <section className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-5 shadow-nexus-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-primary">{copy.listingDetails}</h2>
          <p className="mt-1 text-sm text-muted">{copy.listingDescription}</p>
        </div>
        <ServerDetailsForm key={`${user.id}:${server.id}`} actorId={user.id} server={server} />
      </section>
    </div>
  );
}
