/** Client-safe personal Home summary types (no DB/service imports). */

export type PersonalChangeReason = "releaseWatch" | "discussionFollow" | "replyToMe" | "resourceQa";

export type PersonalChangesSummary = {
  status: "ok" | "empty" | "partial" | "error" | "hidden";
  items: {
    id: string;
    reason: PersonalChangeReason;
    title: string;
    href: string;
    createdAt: string;
  }[];
  failedSources: PersonalChangeReason[];
};
