/** HTTP links are limited to an explicitly enabled local development origin. */
export function parseAccountMailAppUrl(value: string, allowLocalHttp = false): URL {
  const url = new URL(value);
  const localHttp =
    allowLocalHttp &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid account mail application URL");
  }
  return url;
}
