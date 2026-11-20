"use client";
import {
  canChangeOrganizationMember,
  canManageOrganization,
  type OrganizationTeamRole,
} from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../../lib/i18n";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { confirmAction } from "../../shell/confirm-action";
import { linkAccentSm } from "../../shell/link-shell";
import { panelClipSpace5P5 } from "../../shell/panel-shell";
import { surfaceSpace2P4 } from "../../shell/surface-shell";
import { typeFlexWrapGap4, typeSmSuccess } from "../../shell/type-shell";
import { organizationBatchCopy } from "../organization-batch-copy";
import { confirmsOrganizationMemberMutation } from "../organization-member-confirmation";
import {
  type OrganizationTeamPage,
  type OrganizationTeamQuery,
  organizationTeamHref,
  organizationTeamPageSchema,
} from "../organization-team-contract";
import { organizationTeamCopy } from "../organization-team-copy";
import { organizationRequest } from "../organization-workspace-client";
import { getOrganizationCopy } from "../organization-workspace-copy";
import { OrganizationMemberEditor } from "./organization-member-editor";
import { OrganizationTeamBatch } from "./organization-team-batch";
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
    team = getOrganizationCopy(locale),
    batch = organizationBatchCopy(locale);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [
      ...Object.values(copy),
      ...Object.values(team),
      ...Object.values(batch),
      ...Object.values(getUserPlatformCopy(locale)),
    ].includes(text)
      ? text
      : fallback;
  }
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
        { "x-nexus-actor-id": actorId },
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
          { "x-nexus-actor-id": actorId },
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
        setError(safeMessage(failure, copy.uncertain));
      }
      return false;
    } finally {
      guard.current = false;
      if (alive.current) setPending(false);
    }
  }
  const filtered = !!filters.query || filters.role !== undefined || filters.access !== undefined;
  return (
    <section className={panelClipSpace5P5} aria-busy={pending}>
      <p className="text-xs text-muted">{copy.private}</p>
      {data.owner && (
        <div className={surfaceSpace2P4}>
          <p className="text-xs text-muted">{team.owner}</p>
          <Link
            href={`/users/${encodeURIComponent(data.owner.username)}`}
            className={`${linkAccentSm} break-words`}
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
          className={linkAccentSm}
        >
          {copy.management}
        </Link>
      ) : (
        <ErrorState
          id="organization-team-directory-readonly"
          title={team.readOnly}
          description={team.readOnlyHint}
        />
      )}
      {canManageOrganization(data.role) && (
        <OrganizationTeamBatch
          key={data.organization.updatedAt}
          data={data}
          actorId={actorId}
          locale={locale}
          disabled={pending || blocked}
          acquire={() => {
            if (guard.current || blocked) return false;
            guard.current = true;
            setPending(true);
            setError("");
            setMessage("");
            return true;
          }}
          release={() => {
            guard.current = false;
            if (alive.current) setPending(false);
          }}
          onFailure={(problem) => {
            if (alive.current) {
              setBlocked(true);
              setError(
                [
                  ...Object.values(copy),
                  ...Object.values(team),
                  ...Object.values(batch),
                  ...Object.values(getUserPlatformCopy(locale)),
                ].includes(problem)
                  ? problem
                  : copy.uncertain,
              );
            }
          }}
          onCommitted={async (organization, signal) => {
            if (!alive.current) return;
            setMessage(organizationBatchCopy(locale).saved);
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
                signal,
                { "x-nexus-actor-id": actorId },
              ),
            );
            if (
              !refreshed.success ||
              refreshed.data.organization.id !== organization.id ||
              Date.parse(refreshed.data.organization.updatedAt) < Date.parse(organization.updatedAt)
            )
              throw new Error(copy.uncertain);
            if (alive.current) setData(refreshed.data);
          }}
        />
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
                onRemove={async () => {
                  if (pending || blocked) return;
                  if (
                    !(await confirmAction({
                      title: team.remove,
                      object: `${member.displayName} (@${member.username})`,
                      consequences: team.removeConfirm,
                      confirmLabel: team.remove,
                      cancelLabel: organizationBatchCopy(locale).cancel,
                      closeLabel: organizationBatchCopy(locale).cancel,
                    }))
                  )
                    return;
                  void mutate(member, null);
                }}
              />
              {data.role === "owner" && ["admin", "developer", "member"].includes(member.role) && (
                <Link
                  href={`/workspace/organizations/${encodeURIComponent(data.organization.id)}?${new URLSearchParams({ q: member.username })}`}
                  className={`${linkAccentSm} text-xs`}
                >
                  {copy.transfer}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={copy.empty}
          description={filtered ? copy.emptyFilteredHint : copy.emptyHint}
          action={
            <Link
              href={`/workspace/organizations/${encodeURIComponent(data.organization.id)}/team`}
              className={linkAccentSm}
            >
              {copy.reset}
            </Link>
          }
        />
      )}
      {(error || blocked) && (
        <ErrorState
          title={error || copy.uncertain}
          description={copy.uncertainHint}
          action={
            <a href={organizationTeamHref(data.organization.id, filters)} className={linkAccentSm}>
              {copy.uncertain}
            </a>
          }
        />
      )}
      {message && (
        <p role="status" className={typeSmSuccess}>
          {message}
        </p>
      )}
      <nav aria-label={copy.title} className={typeFlexWrapGap4}>
        <a href={organizationTeamHref(data.organization.id, filters)} className={linkAccentSm}>
          {copy.latest}
        </a>
        {data.nextCursor && (
          <Link
            prefetch={false}
            href={organizationTeamHref(data.organization.id, filters, data.nextCursor)}
            className={linkAccentSm}
          >
            {copy.older}
          </Link>
        )}
      </nav>
    </section>
  );
}
