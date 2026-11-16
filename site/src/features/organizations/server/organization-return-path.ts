export function organizationReturnPath(
  id?: string,
  section = "",
  values: Record<string, string | string[] | undefined> = {},
) {
  const base = "/workspace/organizations";
  if (id !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/u.test(id)) return base;
  const path = id ? `${base}/${id}${section ? `/${section}` : ""}` : base;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
    else if (value !== undefined) query.append(key, value);
  }
  return query.size ? `${path}?${query}` : path;
}
