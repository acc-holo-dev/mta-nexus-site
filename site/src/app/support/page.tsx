import { SupportPageSurface, supportMetadata } from "../../features/support/page-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => supportMetadata();
export default function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SupportPageSurface searchParams={searchParams} />;
}
