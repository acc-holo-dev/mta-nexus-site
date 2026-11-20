import type { Metadata } from "next";
import { getRequestLocale } from "../../../lib/i18n/server";
import { serverContentService } from "../../../lib/services/servers/server-content-service";
import { ContextPublicationHistoryScreen } from "../../community/context-history-server";
import { serverPublicationHistoryCopy } from "../server-publication-history-copy";

export async function serverPublicationHistoryMetadata(): Promise<Metadata> {
  const copy = serverPublicationHistoryCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

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

export async function ServerPublicationHistoryRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; contentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await params;
  return ServerPublicationHistoryScreen({ ...scope, searchParams });
}
