import {
  ServerObservationBrowserPage,
  serverObservationBrowserMetadata,
} from "../../../../features/servers/observations-server";

export const dynamic = "force-dynamic";

export const generateMetadata = serverObservationBrowserMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerObservationBrowserPage({
    target: { slug: (await params).slug },
    managed: false,
    searchParams: await searchParams,
  });
}
