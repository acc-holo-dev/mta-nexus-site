import { SupportPageSurface, supportMetadata } from "../../../components/support-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = () => supportMetadata(true);
export default function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <SupportPageSurface staff searchParams={searchParams} />
    </div>
  );
}
