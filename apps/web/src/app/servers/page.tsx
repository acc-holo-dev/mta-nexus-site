import Link from "next/link";
import { Plus, Server as ServerIcon } from "lucide-react";
import { MtaMasterServerDirectory } from "../../components/mta-master-server-directory";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export default async function ServersPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-base pb-6 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-primary sm:text-3xl">
            <ServerIcon className="h-7 w-7 shrink-0 text-accent" aria-hidden="true" />
            <span>{dictionary.servers.title}</span>
          </h1>
          <p className="mt-1 text-xs text-secondary">{dictionary.servers.description}</p>
        </div>
        <Link
          href="/workspace/servers/new"
          className="flex self-start items-center gap-1.5 rounded-lg bg-accent-soft px-4 py-2 text-xs font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current md:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{dictionary.servers.addListing}</span>
        </Link>
      </div>
      <MtaMasterServerDirectory locale={locale} />
    </div>
  );
}
