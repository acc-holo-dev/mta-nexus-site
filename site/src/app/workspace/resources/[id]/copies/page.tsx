import {
  ResourceCopiesScreen,
  resourceCopiesMetadata,
} from "../../../../../features/resources/resource-copies-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceCopiesMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourceCopiesScreen(props);
}
