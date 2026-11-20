import {
  FinancialReconciliationDetailScreen,
  financialReconciliationDetailMetadata,
} from "../../../../../features/commerce/financial-reconciliation-detail-server";

export const dynamic = "force-dynamic";

export const generateMetadata = financialReconciliationDetailMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return FinancialReconciliationDetailScreen({ params, searchParams });
}
