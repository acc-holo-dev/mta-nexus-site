import {
  ServerObservationBrowserPage,
  serverObservationBrowserMetadata,
} from "../../../../../components/server-observation-browser-page";
export const dynamic = "force-dynamic";
export const generateMetadata = serverObservationBrowserMetadata;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerObservationBrowserPage({
    target: { id: (await params).id },
    managed: true,
    searchParams: await searchParams,
  });
}
