import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Activity, KeyRound, Server, Users } from "lucide-react";
import { authService } from "../../../../lib/services/auth-service";
import { serverService } from "../../../../lib/services/server-service";
import { InstallationKeyRotation } from "../../../../components/installation-key-rotation";

export const dynamic = "force-dynamic";

export default async function ServerManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = (await cookies()).get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <p className="font-caption text-muted">Sign in to manage this server.</p>
        <Link href="/auth/login" className="inline-block px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold">
          Sign in
        </Link>
      </div>
    );
  }

  const server = await serverService.getServerById(id);
  if (!server || (server.ownerId !== user.id && user.role !== "admin")) notFound();

  const telemetry = await serverService.getServerTelemetry(server.id);
  const hasFreshHeartbeat =
    server.status === "active" &&
    server.updatedAt.getTime() >= Date.now() - 3 * 60 * 1000;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/workspace" className="text-xs font-semibold text-accent">← Workspace</Link>
          <h1 className="mt-2 text-2xl font-black text-white">{server.name}</h1>
          <p className="mt-1 text-sm text-neutral-400 font-mono">{server.ipAddress}:{server.port}</p>
        </div>
        <Link href={"/servers/" + server.slug} className="text-sm font-semibold text-accent">
          View public page
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="nexus-panel p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-400"><Activity className="w-4 h-4" /> Live status</div>
          <div className={"mt-2 text-lg font-bold " + (hasFreshHeartbeat ? "text-emerald-400" : "text-neutral-300")}>
            {hasFreshHeartbeat ? "Online" : "Waiting for heartbeat"}
          </div>
        </div>
        <div className="nexus-panel p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-400"><Users className="w-4 h-4" /> Players now</div>
          <div className="mt-2 text-lg font-bold text-white">{hasFreshHeartbeat ? telemetry.currentPlayers : 0} / {telemetry.maxPlayers}</div>
        </div>
        <div className="nexus-panel p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-400"><Server className="w-4 h-4" /> Peak, 24h</div>
          <div className="mt-2 text-lg font-bold text-white">{telemetry.peakPlayers24h}</div>
        </div>
      </div>

      <section className="nexus-panel p-6 space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><KeyRound className="w-5 h-5 text-amber-400" /> MTA NEXUS Agent</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Install the agent, then put the installation key into its local config. A new key immediately revokes the previous active key.
          </p>
        </div>
        <InstallationKeyRotation serverId={server.id} />
      </section>
    </div>
  );
}
