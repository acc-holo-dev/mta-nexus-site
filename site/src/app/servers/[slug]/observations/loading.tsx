import { ServerObservationBrowserLoading } from "../../../../features/servers/observations-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export default async function Loading() {
  return <div className={pageShellClass}>{await ServerObservationBrowserLoading()}</div>;
}
