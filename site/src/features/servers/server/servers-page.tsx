import { ErrorState, PageHeader } from "@nexus/ui";
import { Plus, Server as ServerIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { serverService } from "../../../lib/services/servers/server-service";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellStack8 } from "../../shell/page-shell";
import { typeIcon7Accent } from "../../shell/type-shell";
import { MtaMasterServerDirectory } from "../components/mta-master-server-directory";
import { mtaListingProfileRecord } from "../model/mta-listing-profile-map";

export async function serversMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).servers.title} | MTA NEXUS`,
  };
}

/**
 * Official MTA directory stays available even when NEXUS listing enrichment fails.
 * `listings === null` is a load failure (ErrorState + retry). An empty successful
 * list is just an empty profile map — never treat those as the same outcome.
 */
export async function ServersPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const listings = await serverService.listServers(200).catch(() => null);
  const profileByEndpoint = listings === null ? {} : mtaListingProfileRecord(listings);

  return (
    <div className={pageShellStack8}>
      <PageHeader
        title={dictionary.servers.title}
        description={dictionary.servers.description}
        icon={<ServerIcon className={typeIcon7Accent} aria-hidden="true" />}
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
      {listings === null ? (
        <ErrorState
          id="servers-listings-profiles-unavailable"
          title={dictionary.servers.listingsProfilesUnavailable}
          description={dictionary.servers.listingsProfilesUnavailableHint}
          action={
            <Link href="/servers" className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : null}
      <MtaMasterServerDirectory locale={locale} profileByEndpoint={profileByEndpoint} />
    </div>
  );
}
