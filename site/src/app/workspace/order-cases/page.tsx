import { OrderCaseListPage, orderCaseMetadata } from "../../../features/commerce/order-case-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = () => orderCaseMetadata(false);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <OrderCaseListPage query={await searchParams} />
    </div>
  );
}
