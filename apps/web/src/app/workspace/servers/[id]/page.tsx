import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Server } from "lucide-react";
import { authService } from "../../../../lib/services/auth-service";
import { serverService } from "../../../../lib/services/server-service";
import { ServerDetailsForm } from "../../../../components/server-details-form";
import { ServerClaimControlPanel } from "../../../../components/server-claim-control-panel";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getManagedServerCopy } from "../../../../lib/managed-server-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Server management | MTA NEXUS",
  robots: { index: false, follow: false },
};

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
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <p className="font-caption text-muted">{copy.signInMessage}</p>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  }

  const server = await serverService.getServerById(id);
  if (!server) notFound();
  if (!(await serverService.canManageServer(server, user))) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div>
        <Link
          href="/workspace/servers"
          className="text-xs font-semibold text-accent hover:underline"
        >
          ← {serverCopy.title}
        </Link>
        <h1 className="mt-2 text-2xl font-black text-primary">{server.name}</h1>
        <p className="mt-1 font-mono text-sm text-muted">
          {server.ipAddress}:{server.port}
        </p>
      </div>

      <div className="nexus-panel flex items-start gap-3 p-4">
        <Server className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-primary">{copy.ownerManaged}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{copy.ownerManagedDescription}</p>
        </div>
      </div>

      {!server.isVerified && (
        <ServerClaimControlPanel serverId={server.id} serverName={server.name} />
      )}

      <section className="nexus-panel space-y-4 p-5 shadow-nexus-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-primary">{copy.listingDetails}</h2>
          <p className="mt-1 text-sm text-muted">{copy.listingDescription}</p>
        </div>
        <ServerDetailsForm server={server} />
      </section>
    </div>
  );
}
