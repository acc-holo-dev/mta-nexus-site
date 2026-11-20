import { WorkspaceHubPage, workspaceHubMetadata } from "../../features/shell/workspace-hub-server";

export const dynamic = "force-dynamic";
export const generateMetadata = workspaceHubMetadata;

export default async function Page() {
  return WorkspaceHubPage();
}
