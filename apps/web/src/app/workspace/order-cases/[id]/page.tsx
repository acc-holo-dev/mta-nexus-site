import { OrderCaseDetailPage, orderCaseMetadata } from "../../../../components/order-case-page";
export const dynamic = "force-dynamic";
export const generateMetadata = () => orderCaseMetadata(false);
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <OrderCaseDetailPage caseId={id} query={query} />;
}
