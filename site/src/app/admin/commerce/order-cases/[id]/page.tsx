import { OrderCaseDetailPage, orderCaseMetadata } from "../../../../../components/order-case-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = () => orderCaseMetadata(true);
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <div className={pageShellClass}>
      <OrderCaseDetailPage staff caseId={id} query={query} />
    </div>
  );
}
