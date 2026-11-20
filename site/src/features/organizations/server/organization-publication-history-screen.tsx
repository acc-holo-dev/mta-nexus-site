import type { Metadata } from "next";
import { getRequestLocale } from "../../../lib/i18n/server";
import { organizationContentService } from "../../../lib/services/organizations/organization-content-service";
import { ContextPublicationHistoryScreen } from "../../community/context-history-server";
import { organizationPublicationHistoryCopy } from "../organization-publication-history-copy";

export async function organizationPublicationHistoryMetadata(): Promise<Metadata> {
  const copy = organizationPublicationHistoryCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export function OrganizationPublicationHistoryScreen(props: {
  id: string;
  contentId: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ContextPublicationHistoryScreen({
    ...props,
    kind: "organizations",
    load: (actor, filters) =>
      organizationContentService.history(props.id, actor, props.contentId, filters),
  });
}
