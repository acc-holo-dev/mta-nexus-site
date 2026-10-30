"use client";
import { type OrganizationTeamRole, organizationTeamRoles } from "@nexus/domain";
import { Avatar, Button } from "@nexus/ui";
import Link from "next/link";
import { useState } from "react";
import type { Locale } from "../lib/i18n";
import { organizationGovernanceCopy } from "../lib/organization-governance-copy";
import { organizationTeamCopy } from "../lib/organization-team-copy";
import type { OrganizationWorkspace } from "../lib/organization-workspace-contract";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { platformFieldClass } from "../lib/user-platform-client";
export function OrganizationMemberEditor({
  member,
  locale,
  actorRole,
  canEdit,
  busy,
  onSave,
  onRemove,
  onSelectOwner,
}: {
  member: OrganizationWorkspace["members"][number];
  locale: Locale;
  actorRole: string;
  canEdit: boolean;
  busy: boolean;
  onSave: (role: OrganizationTeamRole, servers: boolean) => Promise<boolean>;
  onRemove: () => void;
  onSelectOwner?: () => void;
}) {
  const copy = getOrganizationCopy(locale);
  const [role, setRole] = useState(
    organizationTeamRoles.includes(member.role as OrganizationTeamRole) ? member.role : "member",
  );
  const [servers, setServers] = useState(member.managesServers);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(role as OrganizationTeamRole, servers);
      }}
      className="space-y-3 rounded-lg border border-base bg-inset p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar
          src={member.avatarUrl ?? undefined}
          alt={member.displayName}
          fallback={member.username}
        />
        <Link
          className="min-w-0 break-words text-sm text-accent"
          href={`/users/${encodeURIComponent(member.username)}`}
        >
          {member.displayName} (@{member.username})
        </Link>
        <span className="ml-auto text-xs text-muted">
          {member.role === "owner"
            ? organizationTeamCopy(locale).legacyOwner
            : ["admin", "member", "developer"].includes(member.role)
              ? copy[member.role as "admin" | "member" | "developer" | "owner"]
              : member.role}
        </span>
      </div>
      {canEdit && (
        <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm text-secondary">
            <span>{copy.role}</span>
            <select
              className={platformFieldClass}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {organizationTeamRoles
                .filter((value) => actorRole === "owner" || value !== "admin")
                .map((value) => (
                  <option key={value} value={value}>
                    {copy[value]}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={servers}
              onChange={(e) => setServers(e.target.checked)}
            />
            {copy.serverAccess}
          </label>
          <Button type="submit" size="sm">
            {copy.updateMember}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-0 text-sm text-danger underline"
            onClick={onRemove}
          >
            {copy.remove}
          </Button>
        </fieldset>
      )}
      {onSelectOwner && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onSelectOwner}
          className="h-auto min-h-9 px-0 text-sm text-accent underline"
        >
          {organizationGovernanceCopy(locale).choose}
        </Button>
      )}
    </form>
  );
}
