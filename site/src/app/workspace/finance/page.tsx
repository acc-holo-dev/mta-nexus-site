import {
  WorkspaceFinanceScreen,
  workspaceFinanceMetadata,
} from "../../../features/commerce/workspace-finance-server";

export const dynamic = "force-dynamic";

export const generateMetadata = workspaceFinanceMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    currency?: string | string[];
    organizationId?: string | string[];
    scopePage?: string | string[];
  }>;
}) {
  return WorkspaceFinanceScreen({ searchParams });
}
