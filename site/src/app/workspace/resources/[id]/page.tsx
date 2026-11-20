import {
  ResourceManageScreen,
  resourceManageMetadata,
} from "../../../../features/resources/resource-manage-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceManageMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  return ResourceManageScreen(props);
}
