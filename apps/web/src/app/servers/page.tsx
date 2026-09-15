import { serverService } from "../../lib/services/server-service";
import { ServerCard } from "../../components/server-card";
import Link from "next/link";
import { Server as ServerIcon, Plus, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const servers = await serverService.listServers();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232838] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ServerIcon className="w-7 h-7 text-emerald-500" />
            <span>Multi Theft Auto Server Directory</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Discover verified live servers with real-time player telemetry, custom maps, and active communities.
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {servers.map((s) => (
          <ServerCard key={s.id} server={s} />
        ))}
      </div>
    </div>
  );
}
