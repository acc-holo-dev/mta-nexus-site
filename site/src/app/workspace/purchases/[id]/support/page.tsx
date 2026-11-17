import {
  OrderCaseCreatePage,
  orderCaseMetadata,
} from "../../../../../features/commerce/order-case-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = () => orderCaseMetadata(false);
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className={pageShellClass}>
      <OrderCaseCreatePage orderId={(await params).id} />
    </div>
  );
}
