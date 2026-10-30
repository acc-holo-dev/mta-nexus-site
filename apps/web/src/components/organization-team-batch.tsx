"use client";
import {
  canChangeOrganizationMember,
  type OrganizationMemberBatchAction,
  type OrganizationTeamRole,
} from "@nexus/domain";
import { Button } from "@nexus/ui";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import {
  confirmsOrganizationBatchCommand,
  confirmsOrganizationBatchPreview,
  type OrganizationBatchPreview,
} from "../lib/organization-batch-contract";
import { organizationBatchCopy } from "../lib/organization-batch-copy";
import type { OrganizationTeamPage } from "../lib/organization-team-contract";
import { organizationRequest } from "../lib/organization-workspace-client";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { platformFieldClass } from "../lib/user-platform-client";
export function OrganizationTeamBatch({
  data,
  actorId,
  locale,
  disabled,
  acquire,
  release,
  onFailure,
  onCommitted,
}: {
  data: OrganizationTeamPage;
  actorId: string;
  locale: Locale;
  disabled: boolean;
  acquire: () => boolean;
  release: () => void;
  onFailure: (message: string) => void;
  onCommitted: (
    organization: OrganizationTeamPage["organization"],
    signal: AbortSignal,
  ) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [action, setAction] = useState<OrganizationMemberBatchAction["action"]>("role"),
    [role, setRole] = useState<OrganizationTeamRole>("member"),
    [enabled, setEnabled] = useState(true),
    [preview, setPreview] = useState<OrganizationBatchPreview | null>(null),
    [stage, setStage] = useState<"idle" | "reviewing" | "saving">("idle");
  const alive = useRef(true),
    controller = useRef<AbortController | null>(null),
    guard = useRef(false),
    copy = organizationBatchCopy(locale),
    team = getOrganizationCopy(locale);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const eligible = data.members.filter((member) =>
    canChangeOrganizationMember(
      data.role,
      member.role,
      null,
      member.id === actorId,
      member.id === data.organization.ownerId,
    ),
  );
  const change: OrganizationMemberBatchAction =
    action === "role"
      ? { action, role }
      : action === "server_access"
        ? { action, enabled }
        : { action };
  async function perform(write: boolean) {
    if (guard.current || disabled || !selected.length || (write && !preview?.changedCount)) return;
    if (write && action === "remove" && !window.confirm(copy.confirmRemove)) return;
    if (!acquire()) return;
    guard.current = true;
    setStage(write ? "saving" : "reviewing");
    const request = new AbortController();
    controller.current = request;
    const input = { userIds: selected, change, expectedUpdatedAt: data.organization.updatedAt };
    try {
      const result = await organizationRequest(
        `/api/workspace/organizations/${encodeURIComponent(data.organization.id)}/members/batch${write ? "" : "/preview"}`,
        locale,
        "POST",
        write ? { ...input, previewRevision: preview?.previewRevision } : input,
        request.signal,
      );
      if (!alive.current) return;
      if (!write) {
        const reviewed = confirmsOrganizationBatchPreview(result, data.organization.id, input);
        if (!reviewed) throw new Error(copy.uncertain);
        setPreview(reviewed);
      } else {
        const committed =
          preview && confirmsOrganizationBatchCommand(result, data.organization, preview);
        if (!committed) throw new Error(copy.uncertain);
        await onCommitted(committed, request.signal);
        if (alive.current) {
          setSelected([]);
          setPreview(null);
        }
      }
    } catch (failure) {
      if (alive.current) onFailure(failure instanceof Error ? failure.message : copy.uncertain);
    } finally {
      guard.current = false;
      if (alive.current) setStage("idle");
      release();
    }
  }
  const access = (value: NonNullable<OrganizationBatchPreview["members"][number]["after"]>) => (
    <span>
      {["owner", "admin", "developer", "member"].includes(value.role)
        ? team[value.role as OrganizationTeamRole]
        : value.role}{" "}
      · {team.serverAccess}: {value.managesServers ? copy.enabled : copy.disabled} ·{" "}
      {copy.effective}: {value.effectiveServerAccess ? copy.enabled : copy.disabled}
    </span>
  );
  return (
    <section className="space-y-4 rounded-lg border border-base p-4" aria-busy={stage !== "idle"}>
      <h2 className="text-lg font-semibold text-primary">{copy.title}</h2>
      <p className="text-sm text-muted">{copy.help}</p>
      <fieldset disabled={disabled || preview !== null} className="space-y-3">
        <legend className="text-sm text-primary">
          {copy.selected}: {selected.length} / 20
        </legend>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 px-0 text-sm text-accent underline"
            onClick={() => setSelected(eligible.map((member) => member.id))}
          >
            {copy.all}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 px-0 text-sm text-accent underline"
            onClick={() => setSelected([])}
          >
            {copy.clear}
          </Button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {eligible.map((member) => (
            <li key={member.id}>
              <label className="flex min-h-11 items-center gap-3 rounded border border-base p-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={selected.includes(member.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, member.id]
                        : selected.filter((id) => id !== member.id),
                    )
                  }
                />
                <span className="break-words">
                  {member.displayName} (@{member.username})
                </span>
                <span className="sr-only">{copy.select}</span>
              </label>
            </li>
          ))}
        </ul>
        <label className="block space-y-1 text-sm text-primary">
          <span>{copy.action}</span>
          <select
            className={platformFieldClass}
            value={action}
            onChange={(event) => setAction(event.target.value as typeof action)}
          >
            <option value="role">{copy.role}</option>
            <option value="server_access">{copy.access}</option>
            <option value="remove">{copy.remove}</option>
          </select>
        </label>
        {action === "role" && (
          <label className="block space-y-1 text-sm text-primary">
            <span>{team.role}</span>
            <select
              className={platformFieldClass}
              value={role}
              onChange={(event) => setRole(event.target.value as OrganizationTeamRole)}
            >
              {(data.role === "owner"
                ? ["member", "developer", "admin"]
                : ["member", "developer"]
              ).map((value) => (
                <option key={value} value={value}>
                  {team[value as OrganizationTeamRole]}
                </option>
              ))}
            </select>
          </label>
        )}
        {action === "server_access" && (
          <label className="flex min-h-11 items-center gap-3 text-sm text-primary">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            {team.serverAccess}
          </label>
        )}
      </fieldset>
      <p className="text-xs text-muted">{copy.warning}</p>
      {!preview ? (
        <Button
          type="button"
          className="min-h-11"
          disabled={disabled || !selected.length}
          onClick={() => void perform(false)}
        >
          {stage === "reviewing" ? copy.reviewing : copy.preview}
        </Button>
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-primary">
            {copy.review} ({preview.changedCount})
          </h3>
          <ul className="space-y-3">
            {preview.members.map((member) => (
              <li
                key={member.userId}
                className="space-y-1 rounded border border-base p-3 text-sm text-primary"
              >
                <p className="break-words">
                  {member.displayName} (@{member.username})
                </p>
                <p>
                  {copy.before}: {access(member.before)}
                </p>
                <p>
                  {copy.after}: {member.after ? access(member.after) : copy.removed}
                </p>
                {!member.changed && <p className="text-muted">{copy.unchanged}</p>}
              </li>
            ))}
          </ul>
          {!preview.changedCount && (
            <p role="status" className="text-sm text-muted">
              {copy.noChanges}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="min-h-11"
              disabled={disabled || !preview.changedCount}
              onClick={() => void perform(true)}
            >
              {stage === "saving" ? copy.saving : copy.confirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-11 px-0 text-sm text-accent underline"
              disabled={disabled}
              onClick={() => setPreview(null)}
            >
              {copy.cancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
