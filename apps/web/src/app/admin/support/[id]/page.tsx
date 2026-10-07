import { SupportCaseThread } from "../../../../components/support-case-thread";

export default async function AdminSupportCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SupportCaseThread caseId={id} staffMode />;
}
