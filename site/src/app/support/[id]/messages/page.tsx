import {
  SupportMessagePage,
  supportMessageMetadata,
} from "../../../../features/support/messages-server";

export const dynamic = "force-dynamic";
export const generateMetadata = supportMessageMetadata;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SupportMessagePage id={(await params).id} searchParams={searchParams} />;
}
