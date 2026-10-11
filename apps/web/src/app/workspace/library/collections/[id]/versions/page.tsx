import { LibrarySelectionBatchScreen } from "../../../../../../components/library-selection-batch-screen";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Resource version batch | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LibrarySelectionBatchScreen {...props} />;
}
