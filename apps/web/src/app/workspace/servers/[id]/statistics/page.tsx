import {
  ServerStatisticsPage,
  serverStatisticsMetadata,
} from "../../../../../components/server-statistics-page";
export const dynamic = "force-dynamic";
export const generateMetadata = serverStatisticsMetadata;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerStatisticsPage({
    target: { id: (await params).id },
    managed: true,
    searchParams: await searchParams,
  });
}
