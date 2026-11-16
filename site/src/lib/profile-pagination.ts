/** Query parameters are untrusted; the repository clamps valid pages to the total. */
export function parseProfilePage(value: string | string[] | undefined): number {
  return typeof value === "string" && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : 1;
}
