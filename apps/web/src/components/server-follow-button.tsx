"use client";
import { FollowButton } from "./follow-button";
export function ServerFollowButton({
  serverId,
  serverName,
}: {
  serverId: string;
  serverName: string;
}) {
  return <FollowButton targetType="server" targetId={serverId} targetName={serverName} />;
}
