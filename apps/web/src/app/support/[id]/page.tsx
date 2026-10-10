import { SupportPageSurface, supportMetadata } from "../../../components/support-page";
export const dynamic = "force-dynamic";
export const generateMetadata = () => supportMetadata();

export default async function SupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupportPageSurface id={id} />;
}
