import {
  ResourceActivityScreen,
  resourceActivityMetadata,
} from "../../../../../features/resources/resource-activity-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceActivityMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  return ResourceActivityScreen(props);
}
