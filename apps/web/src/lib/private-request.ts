export function privateRequest(
  init: RequestInit,
): RequestInit {
  return {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  };
}
