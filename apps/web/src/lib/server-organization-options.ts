/** Minimal safe metadata for organizations whose server listings the user manages. */
export type ServerOrganizationOption = Readonly<{
  id: string;
  name: string;
  slug: string;
}>;

export function parseServerOrganizations(payload: unknown): ServerOrganizationOption[] | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { organizations?: unknown }).organizations;
  if (!Array.isArray(raw) || raw.length > 100) return null;

  const organizations: ServerOrganizationOption[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { id, name, slug } = item as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/u.test(id) ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      name.length > 100 ||
      typeof slug !== "string" ||
      !/^[a-z0-9-]{2,100}$/u.test(slug)
    ) return null;
    if (!seen.has(id)) {
      organizations.push({ id, name, slug });
      seen.add(id);
    }
  }
  return organizations;
}
