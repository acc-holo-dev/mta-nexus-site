import { PageHeader } from "@nexus/ui";
import { Plus, Server as ServerIcon } from "lucide-react";
import Link from "next/link";
import { MtaMasterServerDirectory } from "../../components/mta-master-server-directory";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { mtaListingProfileRecord } from "../../lib/mta-listing-profile-map";
import { serverService } from "../../lib/services/server-service";

export default async function ServersPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const listings = await serverService.listServers(200).catch(() => []);
  const profileByEndpoint = mtaListingProfileRecord(listings);

  return (
    <div className="min-w-0 space-y-8 overflow-x-clip">
      <PageHeader
        title={dictionary.servers.title}
        description={dictionary.servers.description}
        icon={<ServerIcon className="h-7 w-7 text-accent" aria-hidden="true" />}
        action={
          <Link
            href="/workspace/servers/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent-soft px-4 py-2 text-xs font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{dictionary.servers.addListing}</span>
          </Link>
        }
      />
      <MtaMasterServerDirectory locale={locale} profileByEndpoint={profileByEndpoint} />
    </div>
  );
}
