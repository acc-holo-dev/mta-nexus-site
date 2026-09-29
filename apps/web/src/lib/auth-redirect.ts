const POST_AUTH_DESTINATIONS = new Set(["/community/new"]);

export function getPostAuthDestination(search: string): string {
  const requested = new URLSearchParams(search).get("next");
  return requested && POST_AUTH_DESTINATIONS.has(requested) ? requested : "/workspace";
}
