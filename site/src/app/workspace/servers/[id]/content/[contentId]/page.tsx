import {
  ServerContentEditorPage,
  serverContentEditorMetadata,
} from "../../../../../../features/servers/content-editor-server";

export const dynamic = "force-dynamic";

export const generateMetadata = serverContentEditorMetadata;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; contentId: string }>;
}) {
  return ServerContentEditorPage(await params);
}
