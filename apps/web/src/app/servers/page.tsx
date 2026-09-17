import Link from "next/link";
import { Server as ServerIcon, Plus } from "lucide-react";
import { mtaMasterDirectoryService } from "../../lib/services/mta-master-directory-service";
import { MtaMasterServerDirectory } from "../../components/mta-master-server-directory";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const directory = await mtaMasterDirectoryService.getDirectory().catch(() => null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ServerIcon className="w-7 h-7 text-emerald-500" />
            <span>Multi Theft Auto servers</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">Live public server data is sourced from the official MTA master-list.</p>
        </div>
        <Link href="/workspace/servers/new" className="self-start md:self-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors">
          <Plus className="w-4 h-4" />
          <span>Add your listing</span>
        </Link>
      </div>

      {directory ? (
        <MtaMasterServerDirectory directory={directory} />
      ) : (
        <div className="nexus-panel p-6 text-sm text-neutral-400">The official MTA server directory is temporarily unavailable. Try again shortly.</div>
      )}
    </div>
  );
}
