export type ServerReviewStatus = "published" | "withdrawn" | "removed";
export type ServerReviewInteractionSource = "follow";

export type ServerReviewCommand =
  | { action: "save"; expectedRevision: number; text: string; rating: number }
  | { action: "withdraw"; expectedRevision: number };

export type ServerReviewModeration = {
  action: "remove";
  expectedRevision: number;
  notes: string;
};

export type ServerReviewView = {
  id: string;
  text: string;
  rating: number;
  status: ServerReviewStatus;
  revision: number;
  interactionSource: ServerReviewInteractionSource;
  createdAt: Date;
  updatedAt: Date | null;
  author: { username: string; displayName: string } | null;
};

/** Pure eligibility for verified-interaction reviews (no star ranking magic). */
export function serverReviewEligibility(input: {
  following: boolean;
  ownsServer: boolean;
  removed: boolean;
}): { eligible: boolean; reason: "ok" | "follow_required" | "owner_conflict" | "moderated" } {
  if (input.removed) return { eligible: false, reason: "moderated" };
  if (input.ownsServer) return { eligible: false, reason: "owner_conflict" };
  if (!input.following) return { eligible: false, reason: "follow_required" };
  return { eligible: true, reason: "ok" };
}
