import type { CommunityTopicSubmission } from "./community-topic-submission";

type CommunityTopicDraft = {
  title: string;
  body: string;
  type: "post" | "question";
  tags: string;
};
export type CommunityTopicIntent = {
  actorId: string;
  submission: CommunityTopicSubmission;
  draft: CommunityTopicDraft;
};

function slot(actorId: string) {
  return `nexus:community-topic:intent:v1:${actorId}`;
}

function parseCommunityTopicIntent(raw: string, actorId: string): CommunityTopicIntent | null {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(actorId) || raw.length > 60_000) return null;
  try {
    const item = JSON.parse(raw) as {
      version?: unknown;
      actorId?: unknown;
      submission?: Partial<CommunityTopicSubmission>;
      draft?: Partial<CommunityTopicDraft>;
    };
    const submission = item.submission,
      draft = item.draft;
    if (
      item.version !== 1 ||
      item.actorId !== actorId ||
      !submission ||
      !draft ||
      typeof draft.title !== "string" ||
      draft.title.length > 200 ||
      typeof draft.body !== "string" ||
      draft.body.length > 20_000 ||
      typeof draft.tags !== "string" ||
      draft.tags.length > 500 ||
      !["post", "question"].includes(String(draft.type)) ||
      typeof submission.slug !== "string" ||
      submission.slug.length > 200 ||
      !/^[a-z0-9-]{3,200}-[a-f0-9]{32}$/u.test(submission.slug) ||
      submission.title !== draft.title.trim() ||
      submission.body !== draft.body.trim() ||
      submission.type !== draft.type ||
      !Array.isArray(submission.tags) ||
      !submission.tags.every((tag) => typeof tag === "string") ||
      JSON.stringify(submission.tags) !==
        JSON.stringify(
          draft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ) ||
      submission.title.length < 3 ||
      submission.body.length < 10
    )
      return null;
    return {
      actorId,
      submission: {
        title: submission.title,
        slug: submission.slug,
        body: submission.body,
        type: draft.type as CommunityTopicDraft["type"],
        tags: [...submission.tags],
      },
      draft: {
        title: draft.title,
        body: draft.body,
        type: draft.type as CommunityTopicDraft["type"],
        tags: draft.tags,
      },
    };
  } catch {
    return null;
  }
}

export function readCommunityTopicIntent(actorId: string): {
  intent: CommunityTopicIntent | null;
  available: boolean;
} {
  try {
    const raw = sessionStorage.getItem(slot(actorId));
    if (raw === null) return { intent: null, available: true };
    const intent = parseCommunityTopicIntent(raw, actorId);
    return { intent, available: Boolean(intent) };
  } catch {
    return { intent: null, available: false };
  }
}

export function writeCommunityTopicIntent(intent: CommunityTopicIntent): boolean {
  try {
    const raw = JSON.stringify({ version: 1, ...intent });
    if (!parseCommunityTopicIntent(raw, intent.actorId)) return false;
    sessionStorage.setItem(slot(intent.actorId), raw);
    return true;
  } catch {
    return false;
  }
}

export function clearCommunityTopicIntent(actorId: string): boolean {
  try {
    sessionStorage.removeItem(slot(actorId));
    return true;
  } catch {
    return false;
  }
}
