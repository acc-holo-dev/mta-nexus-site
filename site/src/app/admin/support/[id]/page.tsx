import { SupportPageSurface, supportMetadata } from "../../../../features/support/page-server";

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
