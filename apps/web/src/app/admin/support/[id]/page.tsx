import { SupportPageSurface, supportMetadata } from "../../../../components/support-page";
export const dynamic = "force-dynamic";
export const generateMetadata = () => supportMetadata(true);

export default async function AdminSupportCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SupportPageSurface id={id} staff />;
}
