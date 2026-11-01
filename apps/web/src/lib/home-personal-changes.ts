import { notificationRepository, resourceReleaseWatchesRepository } from "@nexus/db";
import type { Locale } from "./i18n";
import { followWorkspaceService } from "./services/follow-workspace-service";
import { notificationInboxService } from "./services/notification-inbox-service";

export type PersonalChangeReason = "releaseWatch" | "discussionFollow" | "replyToMe";

export type PersonalChangeItem = {
  id: string;
  reason: PersonalChangeReason;
  title: string;
  href: string;
  createdAt: string;
};

export type PersonalChangesSummary = {
  status: "ok" | "empty" | "partial" | "error" | "hidden";
  items: PersonalChangeItem[];
  failedSources: PersonalChangeReason[];
};

const LIMIT = 12;

function safeInternalHref(value: string | null | undefined): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    Array.from(value).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  )
    return null;
  return value.length <= 2048 ? value : null;
}

/**
 * Finite personal Home summary from effective release watches, discussion follows,
 * and unread replies-to-me (inbox/read semantics). Guest callers should skip this.
 */
export async function loadPersonalChangesSummary(
  actorId: string,
  locale: Locale,
  optedOut: boolean,
): Promise<PersonalChangesSummary> {
  if (optedOut) return { status: "hidden", items: [], failedSources: [] };

  const failedSources: PersonalChangeReason[] = [];
  const items: PersonalChangeItem[] = [];
  const seen = new Set<string>();

  const [inboxResult, watchesResult, followsResult] = await Promise.allSettled([
    (async () => {
      const [formatted, raw] = await Promise.all([
        notificationInboxService.page(
          actorId,
          { query: "", state: "unread", category: "all" },
          locale,
        ),
        notificationRepository.pageInbox(actorId, {
          query: "",
          state: "unread",
          category: "all",
        }),
      ]);
      return { formatted, raw };
    })(),
    resourceReleaseWatchesRepository.page(actorId, 1, "enabled", ""),
    followWorkspaceService.page(actorId, { type: "content", query: "" }),
  ]);

  if (inboxResult.status === "fulfilled") {
    const { formatted, raw } = inboxResult.value;
    for (const item of formatted.items) {
      if (items.length >= LIMIT) break;
      const source = raw.items.find((row) => row.id === item.id);
      const kind =
        source?.data && typeof source.data === "object" && "kind" in source.data
          ? String((source.data as { kind?: unknown }).kind ?? "")
          : "";
      const href = safeInternalHref(item.link);
      if (!href || seen.has(item.id)) continue;

      let reason: PersonalChangeReason | null = null;
      if (kind === "resource_release" || item.category === "commerce") reason = "releaseWatch";
      else if (item.category === "follow") reason = "discussionFollow";
      else if (item.category === "content") reason = "replyToMe";
      if (!reason) continue;

      seen.add(item.id);
      items.push({
        id: item.id,
        reason,
        title: reason === "releaseWatch" ? item.message || item.title : item.title,
        href,
        createdAt: item.createdAt,
      });
    }
  } else {
    failedSources.push("releaseWatch", "discussionFollow", "replyToMe");
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
