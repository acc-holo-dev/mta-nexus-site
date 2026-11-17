import { serverContentService } from "../../../lib/services/servers/server-content-service";
import { ContextPublicationHistoryScreen } from "../../community/context-history-server";
export function ServerPublicationHistoryScreen(props: {
  id: string;
  contentId: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ContextPublicationHistoryScreen({
    ...props,
    kind: "servers",
    load: (actor, filters) =>
      serverContentService.history(props.id, actor, props.contentId, filters),
  });
}
