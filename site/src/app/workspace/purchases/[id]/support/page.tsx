import {
  OrderCaseCreatePage,
  orderCaseMetadata,
} from "../../../../../features/commerce/order-case-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => orderCaseMetadata(false);
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <OrderCaseCreatePage orderId={(await params).id} />;
}
