import { approvalPageHref } from "../../../../../features/trust/public-verification-history-contract";
import { approvalCopy } from "../../../../../features/trust/public-verification-history-copy";
import { ApprovalHistoryPage } from "../../../../../features/trust/public-verification-history-page";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const copy = approvalCopy(await getRequestLocale()),
    { username } = await params;
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: approvalPageHref(username) },
  };
}

export default async function Page(props: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ApprovalHistoryPage(props);
}
