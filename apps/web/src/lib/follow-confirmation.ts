type FollowMutation = {
  success?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  following?: unknown;
};

// A conflict is evidence of the desired state only when the server checked
// the exact follow key and returned that state, never from HTTP 409 alone.
export function confirmsFollowMutation(
  status: number,
  payload: unknown,
  targetType: string,
  targetId: string,
  expectedFollowing: boolean,
): boolean {
  if (!payload || typeof payload !== "object") return false;
  const result = payload as FollowMutation;
  if (
    result.targetType !== targetType ||
    result.targetId !== targetId ||
    result.following !== expectedFollowing
  ) return false;

  return (status >= 200 && status < 300 && result.success === true) ||
    (status === 409 && expectedFollowing && result.success !== true);
}
