import { OrderCaseCreatePage, orderCaseMetadata } from "../../../../../components/order-case-page";

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
