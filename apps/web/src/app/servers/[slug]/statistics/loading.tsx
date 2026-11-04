import { ServerStatisticsLoading } from "../../../../components/server-statistics-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export default async function Loading() {
  return <div className={pageShellClass}>{await ServerStatisticsLoading()}</div>;
}
