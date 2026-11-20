import {
  ResourceCopyCreateScreen,
  resourceCopyCreateMetadata,
} from "../../../../../features/resources/resource-copy-create-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceCopyCreateMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourceCopyCreateScreen(props);
}
