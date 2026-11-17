"use client";
import { FollowButton } from "../../community/follow";
import type { FollowInitialState } from "../../community/follow-initial-state";
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
