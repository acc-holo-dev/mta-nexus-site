import { OrderCaseListPage, orderCaseMetadata } from "../../../components/order-case-page";
export const dynamic = "force-dynamic";
export const generateMetadata = () => orderCaseMetadata(false);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OrderCaseListPage query={await searchParams} />;
}
