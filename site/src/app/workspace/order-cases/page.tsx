import { OrderCaseListPage, orderCaseMetadata } from "../../../features/commerce/order-case-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => orderCaseMetadata(false);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OrderCaseListPage query={await searchParams} />;
}
