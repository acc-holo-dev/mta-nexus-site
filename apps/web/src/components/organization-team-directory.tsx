"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  canChangeOrganizationMember,
  canManageOrganization,
  type OrganizationTeamRole,
} from "@nexus/domain";
import type { Locale } from "../lib/i18n";
import {
  organizationTeamHref,
  organizationTeamPageSchema,
  type OrganizationTeamPage,
  type OrganizationTeamQuery,
} from "../lib/organization-team-contract";
import { organizationTeamCopy } from "../lib/organization-team-copy";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { organizationRequest } from "../lib/organization-workspace-client";
import { confirmsOrganizationMemberMutation } from "../lib/organization-member-confirmation";
import { OrganizationMemberEditor } from "./organization-member-editor";
export function OrganizationTeamDirectory({
  initial,
  filters,
  locale,
  actorId,
}: {
  initial: OrganizationTeamPage;
  filters: OrganizationTeamQuery;
  locale: Locale;
  actorId: string;
}) {
  const [data, setData] = useState(initial),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const guard = useRef(false),
    alive = useRef(true),
    controller = useRef<AbortController | null>(null),
    copy = organizationTeamCopy(locale),
    team = getOrganizationCopy(locale);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  async function mutate(
    member: OrganizationTeamPage["members"][number],
    fields: { role: OrganizationTeamRole; managesServers: boolean } | null,
  ) {
    if (guard.current || blocked) return false;
    guard.current = true;
    setPending(true);
    setError("");
    setMessage("");
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await organizationRequest(
        `/api/workspace/organizations/${encodeURIComponent(data.organization.id)}/members/${encodeURIComponent(member.id)}`,
        locale,
        fields ? "PATCH" : "DELETE",
        { expectedUpdatedAt: data.organization.updatedAt, ...(fields ?? {}) },
        request.signal,
      );
      const committed = confirmsOrganizationMemberMutation(result, data.organization, {
        userId: member.id,
        ...(fields ?? { removed: true }),
      });
      if (!committed) throw new Error(copy.uncertain);
      if (!alive.current) return false;
      setData((current) => ({ ...current, organization: committed }));
      setMessage(fields ? team.updated : team.removed);
      const refreshed = organizationTeamPageSchema.safeParse(
        await organizationRequest(
          organizationTeamHref(
            data.organization.id,
            filters,
            filters.cursor ? JSON.stringify(filters.cursor) : null,
            true,
          ),
          locale,
          "GET",
          undefined,
          request.signal,
        ),
      );
      if (!refreshed.success || refreshed.data.organization.id !== data.organization.id)
        throw new Error(copy.uncertain);
      if (!alive.current) return false;
      setData(refreshed.data);
      return true;
    } catch (failure) {
      if (alive.current) {
        setBlocked(true);
        setError(failure instanceof Error ? failure.message : copy.uncertain);
      }
      return false;
    } finally {
      guard.current = false;
      if (alive.current) setPending(false);
    }
  }
  return (
    <section className="nexus-panel space-y-5 p-5" aria-busy={pending}>
      <p className="text-xs text-muted">{copy.private}</p>
      {data.owner && (
        <div className="space-y-2 rounded-lg border border-base p-4">
          <p className="text-xs text-muted">{team.owner}</p>
          <Link
            href={`/users/${encodeURIComponent(data.owner.username)}`}
            className="break-words text-sm text-accent"
          >
            {data.owner.displayName} (@{data.owner.username})
          </Link>
          <p className="text-xs text-muted">{copy.ownerNote}</p>
        </div>
      )}
      <p className="text-sm text-muted">{team.roleHelp}</p>
      <p className="text-xs text-muted">{team.accessHelp}</p>
      {canManageOrganization(data.role) ? (
        <Link
          href={`/workspace/organizations/${encodeURIComponent(data.organization.id)}`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.management}
        </Link>
      ) : (
        <p className="text-sm text-muted">{team.readOnly}</p>
      )}
      {data.members.length ? (
        <ul className="space-y-3">
          {data.members.map((member) => (
            <li key={`${member.id}:${member.role}:${member.managesServers}`} className="space-y-2">
              <p className="text-xs text-muted">
                {copy.access}: {member.effectiveServerAccess ? copy.yes : copy.no}
              </p>
              <time dateTime={member.joinedAt} className="text-xs text-muted">
                {new Date(member.joinedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </time>
              <OrganizationMemberEditor
                member={member}
                locale={locale}
                actorRole={data.role}
                canEdit={canChangeOrganizationMember(
                  data.role,
                  member.role,
                  null,
                  member.id === actorId,
                  member.id === data.organization.ownerId,
                )}
                busy={pending || blocked}
                onSave={(role, managesServers) => mutate(member, { role, managesServers })}
                onRemove={() => {
                  if (!pending && !blocked && window.confirm(team.removeConfirm))
                    void mutate(member, null);
                }}
              />
              {data.role === "owner" && ["admin", "developer", "member"].includes(member.role) && (
                <Link
                  href={`/workspace/organizations/${encodeURIComponent(data.organization.id)}?${new URLSearchParams({ q: member.username })}`}
                  className="inline-flex min-h-11 items-center text-xs text-accent underline"
                >
                  {copy.transfer}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{copy.empty}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      )}
      {blocked && (
        <a
          href={organizationTeamHref(data.organization.id, filters)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.uncertain}
        </a>
      )}
      <nav aria-label={copy.title} className="flex flex-wrap gap-4">
        <a
          href={organizationTeamHref(data.organization.id, filters)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.latest}
        </a>
        {data.nextCursor && (
          <Link
            prefetch={false}
            href={organizationTeamHref(data.organization.id, filters, data.nextCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.older}
          </Link>
        )}
      </nav>
    </section>
  );
}
