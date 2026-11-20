import {
  FinancialReconciliationTermsScreen,
  financialReconciliationTermsMetadata,
} from "../../../../../../features/commerce/financial-reconciliation-terms-server";

export const dynamic = "force-dynamic";

export const generateMetadata = financialReconciliationTermsMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return FinancialReconciliationTermsScreen({ params, searchParams });
}
