import Link from "next/link";
import { Server as ServerIcon, Plus } from "lucide-react";
import { MtaMasterServerDirectory } from "../../components/mta-master-server-directory";

export default async function ServersPage() {
  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base pb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2.5">
            <ServerIcon className="w-7 h-7 shrink-0 text-accent" aria-hidden="true" />
            <span>Multi Theft Auto servers</span>
          </h1>
          <p className="text-xs text-secondary mt-1">Public server data comes from the official MTA server list. No account is needed to browse.</p>
        </div>
        <Link href="/workspace/servers/new" className="self-start md:self-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-soft text-accent font-semibold text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add your listing</span>
        </Link>
      </div>
      <MtaMasterServerDirectory />
    </div>
  );
}
