import {
  SupportMessagePage,
  supportMessageMetadata,
} from "../../../../features/support/messages-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = supportMessageMetadata;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <SupportMessagePage id={(await params).id} searchParams={searchParams} />
    </div>
  );
}
