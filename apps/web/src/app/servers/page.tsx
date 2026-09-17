import Link from "next/link";
import { Server as ServerIcon, Plus, ShieldCheck } from "lucide-react";
import { serverService } from "../../lib/services/server-service";
import { mtaMasterDirectoryService } from "../../lib/services/mta-master-directory-service";
import { ServerCard } from "../../components/server-card";
import { MtaMasterServerDirectory } from "../../components/mta-master-server-directory";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const [nexusServers, directory] = await Promise.all([
    serverService.listServers(),
    mtaMasterDirectoryService.getDirectory().catch(() => null),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ServerIcon className="w-7 h-7 text-emerald-500" />
            <span>Multi Theft Auto servers</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Browse the public MTA network and separately discover servers with Nexus telemetry.
          </p>
        </div>
        <Link
          href="/workspace"
          className="self-start md:self-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Register Server</span>
        </Link>
      </div>

      {directory ? (
        <MtaMasterServerDirectory directory={directory} />
      ) : (
        <div className="nexus-panel p-6 text-sm text-neutral-400">
          The official MTA server directory is temporarily unavailable. Nexus server telemetry remains available below.
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Nexus verified servers</h2>
            <p className="text-xs text-neutral-400">Servers whose owners connected the Nexus agent and sent a fresh heartbeat.</p>
          </div>
        </div>
        {nexusServers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {nexusServers.map((server) => <ServerCard key={server.id} server={server} />)}
          </div>
        ) : (
          <div className="nexus-panel p-6 text-sm text-neutral-400">No Nexus server has sent a fresh heartbeat yet.</div>
        )}
      </section>
    </div>
  );
}
