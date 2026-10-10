"use client";
import { Button } from "@nexus/ui";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type { Locale } from "../lib/i18n";
import {
  confirmOwnershipTransfer,
  type ownershipTransferResultSchema,
  ownershipTransferSchema,
} from "../lib/organization-governance-contract";
import {
  organizationGovernanceCopy,
  organizationGovernanceMutationError,
} from "../lib/organization-governance-copy";
import type { OrganizationWorkspace } from "../lib/organization-workspace-contract";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
export function OrganizationOwnershipTransfer({
  data,
  target,
  actorId,
  locale,
  busy,
  onBusyChange,
  onCancel,
  onSaved,
  onReload,
}: {
  data: OrganizationWorkspace;
  target: OrganizationWorkspace["members"][number] | null;
  actorId: string;
  locale: Locale;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: (result: z.infer<typeof ownershipTransferResultSchema>) => void;
  onReload: () => void;
}) {
  const copy = organizationGovernanceCopy(locale),
    teamCopy = getOrganizationCopy(locale);
  const [slug, setSlug] = useState(""),
    [formerRole, setFormerRole] = useState<"member" | "admin">("member"),
    [error, setError] = useState("");
  const guard = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (data.role !== "owner" || data.organization.ownerId !== actorId) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target || guard.current || busy) return;
    const parsed = ownershipTransferSchema.safeParse({
      targetId: target.id,
      targetUsername: target.username,
      confirmationSlug: slug,
      formerOwnerRole: formerRole,
      expectedUpdatedAt: data.organization.updatedAt,
    });
    if (!parsed.success || slug !== data.organization.slug) {
      setError(copy.invalid);
      return;
    }
    if (!window.confirm(`${copy.confirm}\n@${target.username} · ${data.organization.name}`)) return;
    guard.current = true;
    onBusyChange(true);
    setError("");
    controller.current = new AbortController();
    try {
      const result = confirmOwnershipTransfer(
        await platformRequest(
          `/api/workspace/organizations/${encodeURIComponent(data.organization.id)}/ownership`,
          locale,
          "POST",
          parsed.data,
          controller.current.signal,
          organizationGovernanceMutationError,
        ),
        data.organization,
        actorId,
        parsed.data,
      );
      if (!result) throw new Error(copy.mutationUnavailable);
      onSaved(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.mutationUnavailable);
    } finally {
      guard.current = false;
      onBusyChange(false);
    }
  }
  return (
    <section
      id="organization-ownership-transfer"
      className="nexus-panel scroll-mt-20 space-y-4 border border-danger/30 p-5"
      aria-busy={busy}
    >
      <h2 className="font-heading text-primary">{copy.transfer}</h2>
      <p className="text-sm text-muted">{copy.description}</p>
      <p className="text-sm text-secondary">{copy.consequence}</p>
      {!target ? (
        <p className="text-sm text-muted">{copy.noSelection}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="break-words text-sm font-semibold text-primary">
            {copy.selected}: {target.displayName} (@{target.username})
          </p>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.formerRole}</span>
            <select
              className={platformFieldClass}
              value={formerRole}
              disabled={busy}
              onChange={(event) => setFormerRole(event.target.value as "member" | "admin")}
            >
              <option value="member">{teamCopy.member}</option>
              <option value="admin">{teamCopy.admin}</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.confirmation}</span>
            <input
              className={platformFieldClass}
              required
              maxLength={80}
              autoComplete="off"
              value={slug}
              disabled={busy}
              onChange={(event) => setSlug(event.target.value)}
            />
            <span className="block break-all text-xs text-muted">
              {copy.confirmHelp}: {data.organization.slug}
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="danger"
              disabled={busy || slug !== data.organization.slug}
              isLoading={busy}
            >
              {copy.submit}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onReload}
            className="min-h-9 text-sm text-accent underline"
          >
            {copy.reload}
          </button>
        </div>
      )}
    </section>
  );
}
