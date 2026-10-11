"use client";
import { organizationContentCopy } from "../lib/organization-content-copy";
import type { OrganizationTeamRole } from "@nexus/domain";
import {
  canChangeOrganizationMember,
  canManageOrganization,
  organizationTeamRoles,
} from "@nexus/domain";
import { Avatar, Button } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { organizationGovernanceCopy } from "../lib/organization-governance-copy";
import { organizationRequest as platformRequest } from "../lib/organization-workspace-client";
import {
  editableOrganizationSchema,
  memberAddSchema,
  type OrganizationWorkspace,
  organizationWorkspaceSchema,
} from "../lib/organization-workspace-contract";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { platformFieldClass } from "../lib/user-platform-client";
import { OrganizationOwnershipTransfer } from "./organization-ownership-transfer";
import { OrganizationProfileForm } from "./organization-profile-form";

export function OrganizationWorkspacePanel({
  initial,
  locale,
  actorId,
  query,
}: {
  initial: OrganizationWorkspace;
  locale: Locale;
  actorId: string;
  query: string;
}) {
  const copy = getOrganizationCopy(locale);
  const governanceCopy = organizationGovernanceCopy(locale);
  const router = useRouter();
  const [data, setData] = useState(initial);
  useEffect(() => {
    setData(initial);
  }, [initial]);
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<OrganizationTeamRole>("member");
  const [servers, setServers] = useState(false);
  const [ownershipTarget, setOwnershipTarget] = useState<
    OrganizationWorkspace["members"][number] | null
  >(null);
  const manageable = canManageOrganization(data.role);
  const path = `/api/workspace/organizations/${encodeURIComponent(data.organization.id)}`;
  async function mutate(
    method: string,
    suffix: string,
    fields: Record<string, unknown>,
    expected: {
      userId?: string;
      username?: string;
      role?: string;
      managesServers?: boolean;
      removed?: boolean;
    },
    success: string,
  ) {
    if (guard.current) return false;
    guard.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await platformRequest(path + suffix, locale, method, {
        ...fields,
        expectedUpdatedAt: data.organization.updatedAt,
      });
      const organization = editableOrganizationSchema.safeParse(result.organization);
      if (
        !organization.success ||
        organization.data.id !== data.organization.id ||
        organization.data.ownerId !== data.organization.ownerId ||
        organization.data.slug !== data.organization.slug ||
        organization.data.updatedAt === data.organization.updatedAt
      )
        throw new Error(copy.unavailable);
      const confirmed =
        method === "POST" && result.member && typeof result.member === "object"
          ? (result.member as Record<string, unknown>)
          : result;
      if (Object.entries(expected).some(([key, value]) => confirmed[key] !== value))
        throw new Error(copy.unavailable);
      // Retain the committed revision even if refreshing the team subsequently fails.
      setData((current) => ({ ...current, organization: organization.data }));
      setMessage(success);
      const filters = new URLSearchParams({ page: String(data.page), q: query });
      try {
        const refreshed = organizationWorkspaceSchema.safeParse(
          await platformRequest(`${path}?${filters}`, locale),
        );
        if (!refreshed.success || refreshed.data.organization.id !== data.organization.id)
          throw new Error(copy.unavailable);
        setData(refreshed.data);
      } catch {
        setError(governanceCopy.refreshFailed);
      }
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.unavailable);
      return false;
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function leave() {
    if (guard.current || !window.confirm(copy.leaveConfirm)) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await platformRequest(`${path}/leave`, locale, "POST", {
        expectedUpdatedAt: data.organization.updatedAt,
      });
      const organization = editableOrganizationSchema.safeParse(result.organization);
      if (
        !organization.success ||
        organization.data.id !== data.organization.id ||
        organization.data.updatedAt === data.organization.updatedAt ||
        result.userId !== actorId ||
        result.removed !== true
      )
        throw new Error(copy.unavailable);
      router.push("/workspace/organizations");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.unavailable);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = memberAddSchema.safeParse({
      username,
      role,
      managesServers: servers,
      expectedUpdatedAt: data.organization.updatedAt,
    });
    if (!parsed.success) {
      setError(copy.invalid);
      return;
    }
    if (
      await mutate(
        "POST",
        "/members",
        parsed.data,
        { username: parsed.data.username, role, managesServers: servers },
        copy.added,
      )
    ) {
      setUsername("");
      setRole("member");
      setServers(false);
    }
  }
  return (
    <div className="space-y-6">
      {!manageable && <p className="nexus-panel p-4 text-sm text-muted">{copy.readOnly}</p>}
      <OrganizationProfileForm
        key={data.organization.updatedAt}
        locale={locale}
        initial={data.organization}
        disabled={!manageable || busy}
        onBusyChange={(value) => {
          guard.current = value;
          setBusy(value);
        }}
        onSave={(organization) => {
          setData((current) => ({ ...current, organization }));
          setMessage(copy.saved);
        }}
      />
      {manageable && (
        <Link className="inline-flex min-h-11 items-center text-sm text-accent underline"
          href={`/workspace/organizations/${encodeURIComponent(data.organization.id)}/content`}>
          {organizationContentCopy(locale).title}
        </Link>
      )}
      {manageable && (
        <Link
          className="inline-flex min-h-9 items-center text-sm text-accent underline"
          href={`/workspace/organizations/${encodeURIComponent(data.organization.id)}/activity`}
        >
          {governanceCopy.history}
        </Link>
      )}
      {data.role === "owner" && data.organization.ownerId === actorId && (
        <OrganizationOwnershipTransfer
          key={`${ownershipTarget?.id ?? "none"}:${data.organization.updatedAt}`}
          data={data}
          target={ownershipTarget}
          actorId={actorId}
          locale={locale}
          busy={busy}
          onBusyChange={(value) => {
            guard.current = value;
            setBusy(value);
          }}
          onCancel={() => setOwnershipTarget(null)}
          onReload={() => router.refresh()}
          onSaved={(result) => {
            setData((current) => ({
              ...current,
              organization: result.organization,
              owner: result.owner,
              role: result.role,
              members: current.members.filter((member) => member.id !== result.owner.id),
            }));
            setOwnershipTarget(null);
            setMessage(governanceCopy.transferred);
            setError("");
            router.refresh();
          }}
        />
      )}
      <section className="nexus-panel space-y-5 p-5" aria-busy={busy}>
        <h2 className="font-heading text-primary">{copy.team}</h2>
        <p className="text-sm text-muted">{copy.roleHelp}</p>
        <p className="text-xs text-muted">{copy.accessHelp}</p>
        {data.owner && (
          <div className="flex items-center gap-3 rounded-lg border border-base p-3">
            <Avatar
              src={data.owner.avatarUrl ?? undefined}
              alt={data.owner.displayName}
              fallback={data.owner.username}
            />
            <Link
              href={`/users/${encodeURIComponent(data.owner.username)}`}
              className="min-w-0 break-words text-sm text-accent"
            >
              {data.owner.displayName} (@{data.owner.username})
            </Link>
            <span className="ml-auto text-xs text-muted">{copy.owner}</span>
          </div>
        )}
        {manageable && (
          <form onSubmit={add} className="space-y-3 rounded-lg border border-base p-4">
            <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-secondary">
                <span>{copy.username}</span>
                <input
                  className={platformFieldClass}
                  required
                  maxLength={80}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <span className="block text-xs text-muted">{copy.usernameHelp}</span>
              </label>
              <label className="block space-y-1 text-sm text-secondary">
                <span>{copy.role}</span>
                <select
                  className={platformFieldClass}
                  value={role}
                  onChange={(e) => setRole(e.target.value as OrganizationTeamRole)}
                >
                  {organizationTeamRoles
                    .filter((value) => data.role === "owner" || value !== "admin")
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
              <Button type="submit" disabled={!username.trim()} isLoading={busy}>
                {copy.add}
              </Button>
            </fieldset>
          </form>
        )}
        <form
          method="GET"
          action={`/workspace/organizations/${encodeURIComponent(data.organization.id)}`}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="min-w-0 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.searchTeam}</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              maxLength={120}
              className={platformFieldClass}
            />
          </label>
          <Button type="submit" size="sm">
            {copy.filter}
          </Button>
        </form>
        {data.members.length ? (
          <div className="space-y-3">
            {data.members.map((member) => (
              <MemberEditor
                key={`${member.id}:${member.role}:${member.managesServers}`}
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
                busy={busy}
                onSave={(nextRole, managesServers) =>
                  mutate(
                    "PATCH",
                    `/members/${encodeURIComponent(member.id)}`,
                    { role: nextRole, managesServers },
                    { userId: member.id, role: nextRole, managesServers },
                    copy.updated,
                  )
                }
                onRemove={() => {
                  if (window.confirm(copy.removeConfirm))
                    void mutate(
                      "DELETE",
                      `/members/${encodeURIComponent(member.id)}`,
                      {},
                      { userId: member.id, removed: true },
                      copy.removed,
                    );
                }}
                onSelectOwner={
                  data.role === "owner" && ["admin", "developer", "member"].includes(member.role)
                    ? () => {
                        setOwnershipTarget(member);
                        document
                          .getElementById("organization-ownership-transfer")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{copy.noMembers}</p>
        )}
        <nav
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
          aria-label={copy.team}
        >
          {data.page > 1 ? (
            <Link
              className="text-accent underline"
              href={teamHref(data.organization.id, data.page - 1, query)}
            >
              {copy.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            {copy.page} {data.page}
          </span>
          {data.hasMore && (
            <Link
              className="text-accent underline"
              href={teamHref(data.organization.id, data.page + 1, query)}
            >
              {copy.next}
            </Link>
          )}
        </nav>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-accent">
            {message}
          </p>
        )}
        {data.role !== "owner" && (
          <button
            type="button"
            disabled={busy}
            className="text-sm text-danger underline"
            onClick={() => void leave()}
          >
            {copy.leave}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          className="text-sm text-accent underline"
          onClick={() => router.refresh()}
        >
          {copy.reload}
        </button>
      </section>
    </div>
  );
}
function teamHref(id: string, page: number, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/workspace/organizations/${encodeURIComponent(id)}${params.size ? `?${params}` : ""}`;
}
function MemberEditor({
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
  const [role, setRole] = useState(member.role);
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
          {member.role in copy
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
          <button className="text-sm text-danger underline" type="button" onClick={onRemove}>
            {copy.remove}
          </button>
        </fieldset>
      )}
      {onSelectOwner && (
        <button
          type="button"
          disabled={busy}
          onClick={onSelectOwner}
          className="min-h-9 text-sm text-accent underline"
        >
          {organizationGovernanceCopy(locale).choose}
        </button>
      )}
    </form>
  );
}
