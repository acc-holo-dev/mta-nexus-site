import {
  ServerObservationBrowserPage,
  serverObservationBrowserMetadata,
} from "../../../../../components/server-observation-browser-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = serverObservationBrowserMetadata;
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
        await ServerObservationBrowserPage({
          target: { id: (await params).id },
          managed: true,
          searchParams: await searchParams,
        })
      }
    </div>
  );
}
