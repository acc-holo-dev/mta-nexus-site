import { OrderCaseCreatePage, orderCaseMetadata } from "../../../../../components/order-case-page";
export const dynamic = "force-dynamic";
export const generateMetadata = () => orderCaseMetadata(false);
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <OrderCaseCreatePage orderId={(await params).id} />;
}
