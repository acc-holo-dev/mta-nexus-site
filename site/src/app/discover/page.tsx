import { DiscoverPage, discoverMetadata } from "../../features/discovery/discover-page-server";

export const dynamic = "force-dynamic";

export const generateMetadata = discoverMetadata;

export default async function Page(props: {
  searchParams: Promise<{
    type?: string | string[];
    q?: string | string[];
    [key: string]: string | string[] | undefined;
  }>;
}) {
  return DiscoverPage(props);
}
