/** SSR/API seed for FollowButton: follow + mute without a client flash. */
export type FollowInitialState = {
  authenticated: boolean;
  actorId?: string | null;
  following: boolean;
  self?: boolean;
  error?: boolean;
  muted?: boolean;
  mutedUntil?: string | null;
};

export function buildFollowInitialState(args: {
  actor: { id: string } | null | undefined;
  targetId: string;
  /** `null` = follow lookup failed (surface error). */
  followedIds: string[] | null;
  /** `null` = mute lookup failed or skipped; omit mute keys so the client can refetch. */
  mute: { muted: boolean; mutedUntil: string | null } | null | undefined;
  self?: boolean;
}): FollowInitialState {
  const actor = args.actor ?? null;
  if (!actor) {
    return {
      authenticated: false,
      actorId: null,
      following: false,
      muted: false,
      mutedUntil: null,
      ...(args.self ? { self: true } : {}),
    };
  }
  return {
    authenticated: true,
    actorId: actor.id,
    following: Array.isArray(args.followedIds) ? args.followedIds.includes(args.targetId) : false,
    error: args.followedIds === null,
    ...(args.self ? { self: true } : {}),
    ...(args.mute
      ? {
          muted: Boolean(args.mute.muted ?? args.mute.mutedUntil),
          mutedUntil: args.mute.mutedUntil,
        }
      : {}),
  };
}
