import {
  ServerStatisticsPage,
  serverStatisticsMetadata,
} from "../../../../../features/servers/statistics-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = serverStatisticsMetadata;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      {
        await ServerStatisticsPage({
          target: { id: (await params).id },
          managed: true,
          searchParams: await searchParams,
        })
      }
    </div>
  );
}
