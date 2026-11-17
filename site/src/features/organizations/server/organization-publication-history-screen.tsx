import { organizationContentService } from "../../../lib/services/organizations/organization-content-service";
import { ContextPublicationHistoryScreen } from "../../community/context-history-server";
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
