import {
  ResourceVariantsScreen,
  resourceVariantsMetadata,
} from "../../../../../features/resources/resource-variants-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceVariantsMetadata;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return ResourceVariantsScreen(props);
}
