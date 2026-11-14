/**
 * Safe public publisher projection for resource cards and detail.
 * Never carries private ids, email, or password material into UI props.
 */
export type PublicResourceAttribution = {
  organization: { name: string; slug: string } | null;
  author: { displayName: string; username: string; href: string } | null;
};

export function mapPublicResourceAttribution(row: {
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorRole: string | null;
  organizationSlug: string | null;
  organizationName: string | null;
}): PublicResourceAttribution {
  const organization =
    row.organizationSlug && row.organizationName
      ? { slug: row.organizationSlug, name: row.organizationName }
      : null;

  const username = row.authorUsername?.trim() || null;
  const displayName = row.authorDisplayName?.trim() || username;
  const author =
    username && displayName
      ? {
          username,
          displayName,
          href:
            row.authorRole === "developer" || row.authorRole === "admin"
              ? `/developers/${encodeURIComponent(username)}`
              : `/users/${encodeURIComponent(username)}`,
        }
      : null;

  return { organization, author };
}
