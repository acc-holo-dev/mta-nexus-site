export function serverReviewQuery(params: URLSearchParams) {
  const keys = [...params.keys()];
  if (keys.length > 1 || (keys.length === 1 && keys[0] !== "page")) {
    throw new Error("Ambiguous review query");
  }
  const raw = params.get("page");
  if (raw === null) return { page: 1 };
  if (!/^[1-9]\d{0,3}$/u.test(raw)) throw new Error("Invalid review page");
  const page = Number(raw);
  if (page > 9999) throw new Error("Invalid review page");
  return { page };
}
