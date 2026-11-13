import { ServerObservationBrowserLoading } from "../../../../../components/server-observation-browser-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export default async function Loading() {
  return <div className={pageShellClass}>{await ServerObservationBrowserLoading()}</div>;
}
