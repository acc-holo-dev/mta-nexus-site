type CommunityTopicType = "question" | "post";

export type CommunityTopicSubmission = {
  title: string;
  slug: string;
  body: string;
  type: CommunityTopicType;
  tags: string[];
};

function topicSlugBase(title: string): string {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 120);
}

export function buildCommunityTopicSubmission(
  input: {
    title: string;
    body: string;
    type: string;
    tags: string;
  },
  now = Date.now(),
): CommunityTopicSubmission | null {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > 200) return null;
  if (body.length < 10 || body.length > 20_000) return null;
  if (input.type !== "question" && input.type !== "post") return null;

  const tags = input.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.join(",").length > 500) return null;

  const base = topicSlugBase(title);
  return {
    title,
    slug: `${base || "topic"}-${now.toString(36)}`,
    body,
    type: input.type,
    tags,
  };
}

export function communityTopicRequest(
  submission: CommunityTopicSubmission,
  signal: AbortSignal,
): RequestInit {
  return {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(submission),
    signal,
  };
}

export function confirmedCommunityTopicPath(status: number, payload: unknown): string | null {
  if (
    status < 200 ||
    status >= 300 ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (
    record.success !== true ||
    !record.content ||
    typeof record.content !== "object" ||
    Array.isArray(record.content)
  ) {
    return null;
  }
  const slug = (record.content as Record<string, unknown>).slug;
  if (typeof slug !== "string" || !slug.trim() || slug.length > 200) {
    return null;
  }
  return `/articles/${encodeURIComponent(slug)}`;
}
