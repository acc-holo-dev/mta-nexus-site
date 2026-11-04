import { OrderCaseListPage, orderCaseMetadata } from "../../../components/order-case-page";

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
