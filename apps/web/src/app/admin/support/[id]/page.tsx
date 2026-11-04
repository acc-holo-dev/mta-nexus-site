import { SupportPageSurface, supportMetadata } from "../../../../components/support-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = () => supportMetadata(true);

export default async function AdminSupportCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className={pageShellClass}>
      <SupportPageSurface id={id} staff />
    </div>
  );
}
