import {
  CollectionWatchesScreen,
  collectionWatchesMetadata,
} from "../../../../../../features/library/collection-watches-server";

export const dynamic = "force-dynamic";

export const generateMetadata = collectionWatchesMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return CollectionWatchesScreen(props);
}
