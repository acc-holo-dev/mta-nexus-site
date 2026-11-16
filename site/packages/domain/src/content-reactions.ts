export const CONTENT_REACTIONS = ["helpful", "thanks", "insight"] as const;
export type ContentReaction = (typeof CONTENT_REACTIONS)[number];
export const CONTENT_REACTION_EMOJI: Record<ContentReaction, string> = {
  helpful: "👍",
  thanks: "❤️",
  insight: "💡",
};
export function contentReactionFromEmoji(emoji: string | null | undefined): ContentReaction | null {
  return CONTENT_REACTIONS.find((value) => CONTENT_REACTION_EMOJI[value] === emoji) ?? null;
}
