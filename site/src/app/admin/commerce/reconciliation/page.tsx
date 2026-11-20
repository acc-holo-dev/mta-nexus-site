import {
  FinancialReconciliationScreen,
  financialReconciliationMetadata,
} from "../../../../features/commerce/financial-reconciliation-server";

export const dynamic = "force-dynamic";

export const generateMetadata = financialReconciliationMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; filter?: string | string[] }>;
}) {
  return FinancialReconciliationScreen({ searchParams });
}
