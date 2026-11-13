import { AppError } from "@nexus/domain";
export function libraryReleaseComparisonQuery(params: URLSearchParams) {
  const invalid = () =>
    new AppError("Invalid release comparison query", 400, "RESOURCE_CONTROL_INVALID");
  for (const key of params.keys())
    if (!["from", "to", "returnPage"].includes(key) || params.getAll(key).length !== 1)
      throw invalid();
  const from = params.get("from") ?? "",
    to = params.get("to") ?? "",
    page = params.get("returnPage") ?? "1";
  if (
    !/^[A-Za-z0-9_-]{1,128}$/u.test(from) ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(to) ||
    from === to ||
    !/^[1-9][0-9]{0,3}$/u.test(page) ||
    Number(page) > 1000
  )
    throw invalid();
  return { from, to, returnPage: Number(page) };
}
