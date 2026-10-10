import { SupportPageSurface, supportMetadata } from "../../components/support-page";
export const dynamic = "force-dynamic";
export const generateMetadata = () => supportMetadata();
export default function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SupportPageSurface searchParams={searchParams} />;
}
