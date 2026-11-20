import {
  ResourceCompatibilityScreen,
  resourceCompatibilityMetadata,
} from "../../../../../features/resources/resource-compatibility-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceCompatibilityMetadata;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return ResourceCompatibilityScreen(props);
}
