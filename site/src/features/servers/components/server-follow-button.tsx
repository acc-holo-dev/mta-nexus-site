"use client";
import type { FollowInitialState } from "../../../lib/follow-initial-state";
import { FollowButton } from "../../../features/community/follow";
export function ServerFollowButton({
  serverId,
  serverName,
  initial,
}: {
  serverId: string;
  serverName: string;
  initial?: FollowInitialState;
}) {
  return (
    <FollowButton
      targetType="server"
      targetId={serverId}
      targetName={serverName}
      initial={initial}
    />
  );
}
