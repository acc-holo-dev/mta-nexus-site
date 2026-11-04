import { SupportPageSurface, supportMetadata } from "../../components/support-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = () => supportMetadata();
export default function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <SupportPageSurface searchParams={searchParams} />
    </div>
  );
}
