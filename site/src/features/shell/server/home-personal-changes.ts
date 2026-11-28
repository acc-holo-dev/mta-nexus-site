import "server-only";

import { notificationRepository, resourceReleaseWatchesRepository } from "@nexus/db";
import type { Locale } from "../../../lib/i18n";
import { followWorkspaceService } from "../../../lib/services/community/follow-workspace-service";
import { formatNotificationInboxPage } from "../../../lib/services/notifications/notification-inbox-service";
import type { PersonalChangeReason, PersonalChangesSummary } from "../home-personal-changes-types";

const LIMIT = 12;

/**
 * Captions the closed Home reason map does not own. The visible label is the
 * notification's own localized title; these tokens must not reuse another type.
 */
type OwnNoticeReason =
  | "licenseTerm"
  | "newFollower"
  | "contentReaction"
  | "publicationActivity"
  | "discussionModeration";

const followerTitles = new Set([
  "New follower",
  "New Follower",
  "Новый подписчик",
  "New Follower / Новый подписчик",
]);
const moderationTitles = new Set([
  "Discussion moderation",
  "Модерация обсуждения",
  "Discussion moderation / Модерация обсуждения",
]);

function notificationKind(data: unknown) {
  return data && typeof data === "object" && "kind" in data
    ? String((data as { kind?: unknown }).kind ?? "")
    : "";
}

/** Home caption follows this row's own kind. A shared inbox category is not a type. */
function inboxPersonalReason(
  data: unknown,
  category: string,
  title: string,
): PersonalChangeReason | OwnNoticeReason | null {
  const kind = notificationKind(data);
  if (kind === "resource_release") return "releaseWatch";
  if (kind === "resource_qa") return "resourceQa";
  if (kind === "license_term") return "licenseTerm";
  if (kind === "content_reaction") return "contentReaction";
  if (kind === "publication_activity") return "publicationActivity";
  if (kind === "discussion_push" && category === "follow") return "discussionFollow";
  if (kind === "discussion_push" && category === "content") return "replyToMe";
  if (category === "follow" && followerTitles.has(title)) return "newFollower";
  if (category === "content" && moderationTitles.has(title)) return "discussionModeration";
  return null;
}

function safeInternalHref(value: string | null | undefined): string | null {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    Array.from(value).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  )
    return null;
  return value.length <= 2048 ? value : null;
}

/**
 * Finite personal Home summary. Inbox rows are captioned by their own kind.
 * Guest callers should skip this.
 */
export async function loadPersonalChangesSummary(
  actorId: string,
  locale: Locale,
  optedOut: boolean,
): Promise<PersonalChangesSummary> {
  if (optedOut) return { status: "hidden", items: [], failedSources: [] };

  const failedSources: PersonalChangeReason[] = [];
  const items: PersonalChangesSummary["items"] = [];
  const seen = new Set<string>();

  const [inboxResult, watchesResult, followsResult] = await Promise.allSettled([
    (async () => {
      const raw = await notificationRepository.pageInbox(actorId, {
        query: "",
        state: "unread",
        category: "all",
      });
      const formatted = formatNotificationInboxPage(raw, locale);
      return { formatted, raw };
    })(),
    resourceReleaseWatchesRepository.page(actorId, 1, "enabled", ""),
    followWorkspaceService.page(actorId, { type: "content", query: "", cursor: undefined }),
  ]);

  if (inboxResult.status === "fulfilled") {
    const { formatted, raw } = inboxResult.value;
    for (const item of formatted.items) {
      if (items.length >= LIMIT) break;
      const source = raw.items.find((row) => row.id === item.id);
      const href = safeInternalHref(item.link);
      if (!href || seen.has(item.id)) continue;

      const reason = inboxPersonalReason(source?.data, item.category, item.title);
      if (!reason) continue;

      seen.add(item.id);
      items.push({
        id: item.id,
        // Own-notice tokens are outside the closed caption map; the row title is that label.
        reason: reason as PersonalChangeReason,
        title: reason === "releaseWatch" ? item.message || item.title : item.title,
        href,
        createdAt: item.createdAt,
      });
    }
  } else {
    failedSources.push("releaseWatch", "discussionFollow", "replyToMe", "resourceQa");
  }

  // Effective enabled watches: source health only (unread release notices already listed).
  if (watchesResult.status === "rejected" && !failedSources.includes("releaseWatch")) {
    failedSources.push("releaseWatch");
  }

  if (followsResult.status === "fulfilled") {
    for (const follow of followsResult.value.items) {
      if (items.length >= LIMIT) break;
      if (follow.targetType !== "content" || !follow.href || !follow.discussion?.latestId) continue;
      // Quiet bookmarks (notifyComments false) are not discussion follows for this summary.
      if (follow.notifyComments === false) continue;
      const href = safeInternalHref(
        `${follow.href}?comment=${encodeURIComponent(follow.discussion.latestId)}#comment-${encodeURIComponent(follow.discussion.latestId)}`,
      );
      if (!href) continue;
      const id = `follow_${follow.id}_${follow.discussion.latestId}`;
      if (seen.has(id) || items.some((entry) => entry.href.split("#")[0] === href.split("#")[0]))
        continue;
      if (
        follow.discussion.latestAt &&
        follow.createdAt &&
        follow.discussion.latestAt <= follow.createdAt
      )
        continue;
      seen.add(id);
      items.push({
        id,
        reason: "discussionFollow",
        title: follow.title ?? follow.href,
        href,
        createdAt: follow.discussion.latestAt ?? follow.createdAt,
      });
    }
  } else if (!failedSources.includes("discussionFollow")) {
    failedSources.push("discussionFollow");
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const bounded = items.slice(0, LIMIT);

  if (
    inboxResult.status === "rejected" &&
    watchesResult.status === "rejected" &&
    followsResult.status === "rejected"
  ) {
    return { status: "error", items: [], failedSources };
  }
  if (bounded.length === 0 && failedSources.length === 0) {
    return { status: "empty", items: [], failedSources: [] };
  }
  if (bounded.length === 0 && failedSources.length > 0) {
    return { status: "error", items: [], failedSources };
  }
  if (failedSources.length > 0) {
    return { status: "partial", items: bounded, failedSources };
  }
  return { status: "ok", items: bounded, failedSources: [] };
}
