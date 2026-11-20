import { readManagedServerClaimStatus } from "@nexus/db";
import { Server } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { serverService } from "../../../lib/services/servers/server-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeLgBoldPrimary,
  typeMt1XsLeadingMuted,
  typeSmBoldPrimary,
} from "../../shell/type-shell";
import { ServerClaimStatusPanel } from "../claim-status-server";
import { ServerDetailsForm } from "../details-controls";
import { getManagedServerCopy } from "../managed-server-view";
import { serverWorkspaceCopy } from "../server-workspace-copy";
export async function serverManagementMetadata(): Promise<Metadata> {
  return {
    title: `${serverWorkspaceCopy(await getRequestLocale()).managementDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ServerManagementScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getRequestLocale();
  const copy = getDictionary(locale).serverManagement;
  const serverCopy = getManagedServerCopy(locale);
  const token = (await cookies()).get("nexus_session")?.value;
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(token);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/workspace/servers/"}
      />
    );
  }

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
    <div className={pageShellMax4xl}>
      <div className="min-w-0">
        <Link href="/workspace/servers" className={linkAccentSm}>
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
          <h2 className={typeSmBoldPrimary}>{copy.ownerManaged}</h2>
          <p className={typeMt1XsLeadingMuted}>{copy.ownerManagedDescription}</p>
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
          <h2 className={typeLgBoldPrimary}>{copy.listingDetails}</h2>
          <p className="mt-1 text-sm text-muted">{copy.listingDescription}</p>
        </div>
        <ServerDetailsForm key={`${user.id}:${server.id}`} actorId={user.id} server={server} />
      </section>
    </div>
  );
}
