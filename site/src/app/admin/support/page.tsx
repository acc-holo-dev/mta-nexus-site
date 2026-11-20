import { SupportPageSurface, supportMetadata } from "../../../features/support/page-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => supportMetadata(true);
export default function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SupportPageSurface staff searchParams={searchParams} />;
}
