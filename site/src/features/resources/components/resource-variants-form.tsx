"use client";
import { type ManagedResourceVariants, RESOURCE_VARIANT_LIMIT } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { resourceVariantCommandSchema } from "@nexus/validation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/private-api-request";
import { confirmedVariantCommand } from "../../../lib/resource-management-confirmation";
import {
  getResourceManagementCopy,
  resourceManagementError,
} from "../../../lib/resource-management-i18n";
import { parseEditableProfile } from "../../../lib/user-platform-client";
import {
  ActionConfirmCheckbox,
  actionConfirmCheckboxFocusClass,
} from "../../../components/action-confirm-checkbox";
import { useNexusLocale } from "../../../components/locale-context";

type Candidate = { productId: string; title: string; slug: string; status: string };
type CandidatePage = { candidates: Candidate[]; page: number; hasMore: boolean };
function candidatePage(value: unknown, page: number): value is CandidatePage {
  if (!value || typeof value !== "object") return false;
  const result = value as CandidatePage;
  return (
    result.page === page &&
    typeof result.hasMore === "boolean" &&
    Array.isArray(result.candidates) &&
    result.candidates.length <= 24 &&
    result.candidates.every(
      (row) =>
        row &&
        typeof row.productId === "string" &&
        /^[A-Za-z0-9_-]{1,128}$/u.test(row.productId) &&
        typeof row.title === "string" &&
        typeof row.slug === "string" &&
        typeof row.status === "string",
    )
  );
}
function managedVersion(value: ManagedResourceVariants) {
  return `${value.anchorProductId}:${value.group?.id ?? ""}:${value.group?.revision ?? 0}`;
}
function isManagedSnapshot(value: unknown): value is ManagedResourceVariants {
  if (!value || typeof value !== "object") return false;
  const data = value as ManagedResourceVariants;
  if (
    typeof data.anchorProductId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(data.anchorProductId)
  )
    return false;
  if (data.group === null) return true;
  const group = data.group;
  return (
    !!group &&
    typeof group.id === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/u.test(group.id) &&
    Number.isSafeInteger(group.revision) &&
    group.revision > 0 &&
    typeof group.title === "string" &&
    Array.isArray(group.variants) &&
    group.variants.length <= RESOURCE_VARIANT_LIMIT &&
    group.variants.every(
      (row) =>
        row &&
        typeof row.productId === "string" &&
        /^[A-Za-z0-9_-]{1,128}$/u.test(row.productId) &&
        typeof row.title === "string" &&
        typeof row.label === "string" &&
        typeof row.slug === "string" &&
        typeof row.status === "string" &&
        typeof row.currentVersion === "string",
    )
  );
}
export function ResourceVariantsForm({
  product,
  managed,
  initialCandidates,
  actorId,
}: {
  actorId: string;
  product: { id: string; title: string };
  managed: ManagedResourceVariants;
  initialCandidates: CandidatePage;
}) {
  const { locale } = useNexusLocale(),
    copy = getResourceManagementCopy(locale);
  const field = useId(),
    lock = useRef(false),
    candidateSequence = useRef(0);
  const [title, setTitle] = useState(managed.group?.title ?? product.title.slice(0, 80));
  const [selected, setSelected] = useState<{ productId: string; title: string; label: string }[]>(
    managed.group?.variants.map((row) => ({
      productId: row.productId,
      title: row.title,
      label: row.label,
    })) ?? [{ productId: product.id, title: product.title, label: copy.base }],
  );
  const [candidates, setCandidates] = useState(initialCandidates),
    [loading, setLoading] = useState(false);
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const [base, setBase] = useState(managed);
  const [observedPropsVersion, setObservedPropsVersion] = useState(managedVersion(managed));
  const [checked, setChecked] = useState<{
    value: ManagedResourceVariants;
    propsVersion: string;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(true);
  const [foreignActor, setForeignActor] = useState(false);
  const checkedUsable =
    checked && checked.propsVersion === managedVersion(managed) ? checked.value : null;
  const newest =
    checkedUsable ??
    (managedVersion(managed) !== observedPropsVersion &&
    managedVersion(managed) !== managedVersion(base)
      ? managed
      : null);
  const disabled = busy || foreignActor || !identityVerified;
  const blocked = disabled || saved || needsCheck || Boolean(newest);
  function closeForeignDraft() {
    candidateSequence.current += 1;
    setTitle("");
    setSelected([]);
    setReason("");
    setCandidates({ candidates: [], page: 1, hasMore: false });
    setChecked(null);
    setForeignActor(true);
    setError(copy.variantsIdentityChanged);
  }
  async function checkSaved() {
    if (lock.current || foreignActor) return;
    lock.current = true;
    candidateSequence.current += 1;
    setLoading(false);
    setBusy(true);
    setIdentityVerified(false);
    setChecked(null);
    const propsVersion = managedVersion(managed);
    try {
      const identityResponse = await fetch("/api/account/profile", privateApiRequest());
      const identity = parseEditableProfile(
        (await identityResponse.json().catch(() => null))?.profile,
      );
      if (!identityResponse.ok || !identity) throw new Error(copy.variantsCheckFailed);
      if (identity.id !== actorId) {
        closeForeignDraft();
        return;
      }
      const response = await fetch(
        `/api/products/${encodeURIComponent(product.id)}/variants`,
        privateApiRequest(),
      );
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        const recheckResponse = await fetch("/api/account/profile", privateApiRequest());
        const recheck = parseEditableProfile(
          (await recheckResponse.json().catch(() => null))?.profile,
        );
        if (!recheckResponse.ok || !recheck) throw new Error(copy.variantsCheckFailed);
        if (recheck.id !== actorId) {
          closeForeignDraft();
          return;
        }
        setIdentityVerified(true);
        throw new Error(copy.variantsCheckFailed);
      }
      const responseActor = response.headers.get("X-Nexus-Actor-Id");
      if (!responseActor) throw new Error(copy.variantsCheckFailed);
      if (responseActor !== actorId) {
        closeForeignDraft();
        return;
      }
      if (!isManagedSnapshot(value)) throw new Error(copy.variantsCheckFailed);
      setIdentityVerified(true);
      setChecked({ value, propsVersion });
      setError("");
    } catch {
      setError(copy.variantsCheckFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function changePage(page: number) {
    if (lock.current || foreignActor || !identityVerified) return;
    const sequence = ++candidateSequence.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/products/${product.id}/variants/candidates?page=${page}`,
        privateApiRequest(),
      );
      const body = await response.json().catch(() => null);
      if (sequence !== candidateSequence.current) return;
      if (!response.ok || !candidatePage(body, page)) {
        if ([401, 403, 404].includes(response.status)) {
          setIdentityVerified(false);
          setNeedsCheck(true);
        }
        setError(resourceManagementError(locale, body?.code));
        return;
      }
      const responseActor = response.headers.get("X-Nexus-Actor-Id");
      if (!responseActor) throw new Error(copy.variantsCheckFailed);
      if (responseActor !== actorId) {
        closeForeignDraft();
        return;
      }
      setCandidates(body);
    } catch {
      if (sequence === candidateSequence.current) setError(copy.errors.fallback);
    } finally {
      if (sequence === candidateSequence.current) setLoading(false);
    }
  }
  function move(index: number, delta: number) {
    setDirty(true);
    setSelected((rows) => {
      const next = [...rows],
        target = index + delta;
      if (target < 0 || target >= next.length) return rows;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>, action: "save" | "remove") {
    event.preventDefault();
    if (lock.current || blocked || (action === "remove" && !confirmed)) return;
    const parsed = resourceVariantCommandSchema.safeParse(
      action === "save"
        ? {
            action,
            expectedGroupId: base.group?.id ?? null,
            expectedRevision: base.group?.revision ?? 0,
            title,
            variants: selected.map(({ productId, label }) => ({ productId, label })),
            reason,
          }
        : {
            action,
            expectedGroupId: base.group?.id,
            expectedRevision: base.group?.revision,
            reason,
          },
    );
    if (!parsed.success) {
      setError(copy.errors.RESOURCE_VARIANTS_INVALID);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const options = privateApiRequest({ method: "POST", json: parsed.data });
      const headers = new Headers(options.headers);
      headers.set("X-Nexus-Actor-Id", actorId);
      const response = await fetch(`/api/products/${product.id}/variants`, { ...options, headers });
      const body = await response.json().catch(() => null);
      if (body?.code === "ACTOR_CHANGED") {
        closeForeignDraft();
        return;
      }
      if (!response.ok || !confirmedVariantCommand(body, product.id, parsed.data)) {
        setError(resourceManagementError(locale, body?.code));
        setNeedsCheck(
          response.ok || [401, 403, 404, 409].includes(response.status) || response.status >= 500,
        );
        return;
      }
      setSaved(true);
    } catch {
      setError(copy.errors.fallback);
      setNeedsCheck(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (foreignActor || !identityVerified) {
    return (
      <section className="space-y-6">
        {busy && <p role="status">{copy.working}</p>}
        {error && <ErrorState title={error} description={copy.actionFailedDescription} />}
        {(needsCheck || saved) && !foreignActor && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void checkSaved()}>
            {copy.variantsCheck}
          </Button>
        )}
      </section>
    );
  }
  return (
    <section className="space-y-6">
      <form onSubmit={(event) => submit(event, "save")} className="nexus-panel space-y-4 p-5">
        <p className="text-sm text-secondary">{copy.variantNote}</p>
        <label htmlFor={`${field}-title`} className="block text-sm text-secondary">
          {copy.title}
        </label>
        <input
          id={`${field}-title`}
          value={title}
          minLength={3}
          maxLength={80}
          required
          disabled={disabled}
          onChange={(event) => {
            setTitle(event.target.value);
            setDirty(true);
          }}
          className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
        />
        <h2 className="font-semibold text-primary">
          {copy.selected} · {selected.length}/{RESOURCE_VARIANT_LIMIT}
        </h2>
        <ol className="space-y-3">
          {selected.map((row, index) => (
            <li key={row.productId} className="rounded-lg border border-base p-4">
              <p className="mb-2 break-words text-sm text-primary">{row.title}</p>
              <label
                htmlFor={`${field}-label-${row.productId}`}
                className="block text-xs text-secondary"
              >
                {copy.label}
              </label>
              <input
                id={`${field}-label-${row.productId}`}
                value={row.label}
                minLength={1}
                maxLength={60}
                required
                disabled={disabled}
                onChange={(event) => {
                  setDirty(true);
                  setSelected((rows) =>
                    rows.map((value) =>
                      value.productId === row.productId
                        ? { ...value, label: event.target.value }
                        : value,
                    ),
                  );
                }}
                className="my-2 w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
              />
              <div className="flex flex-wrap gap-4 text-xs text-accent">
                <Button
                  type="button"
                  variant="ghost"
                  size="touch"
                  disabled={disabled || index === 0}
                  aria-label={`${copy.up}: ${row.title}`}
                  onClick={() => move(index, -1)}
                  className="h-auto min-h-11 px-0 text-xs text-accent disabled:opacity-40"
                >
                  {copy.up}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="touch"
                  disabled={disabled || index === selected.length - 1}
                  aria-label={`${copy.down}: ${row.title}`}
                  onClick={() => move(index, 1)}
                  className="h-auto min-h-11 px-0 text-xs text-accent disabled:opacity-40"
                >
                  {copy.down}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="touch"
                  disabled={disabled || row.productId === product.id}
                  aria-label={`${copy.remove}: ${row.title}`}
                  onClick={() => {
                    setDirty(true);
                    setSelected((rows) =>
                      rows.filter((value) => value.productId !== row.productId),
                    );
                  }}
                  className="h-auto min-h-11 px-0 text-xs text-accent disabled:opacity-40"
                >
                  {copy.remove}
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <label htmlFor={`${field}-reason`} className="block text-sm text-secondary">
          {copy.reason}
        </label>
        <textarea
          id={`${field}-reason`}
          value={reason}
          minLength={5}
          maxLength={1000}
          rows={3}
          required
          disabled={disabled}
          onChange={(event) => {
            setReason(event.target.value);
            setDirty(true);
          }}
          className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
        />
        <Button type="submit" disabled={blocked} className="min-h-11">
          {busy ? copy.working : copy.save}
        </Button>
      </form>
      <section className="nexus-panel space-y-3 p-5" aria-labelledby={`${field}-candidates`}>
        <h2 id={`${field}-candidates`} className="font-semibold text-primary">
          {copy.candidates}
        </h2>
        <ul className="space-y-2">
          {candidates.candidates.map((row) => (
            <li
              key={row.productId}
              className="flex items-center justify-between gap-4 rounded border border-base p-3"
            >
              <span className="break-words text-sm text-secondary">
                {row.title}
                <span className="block text-xs text-muted">{row.slug}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={
                  disabled ||
                  selected.length >= RESOURCE_VARIANT_LIMIT ||
                  selected.some((value) => value.productId === row.productId)
                }
                aria-label={`${copy.add}: ${row.title}`}
                onClick={() => {
                  setDirty(true);
                  setSelected((rows) => [
                    ...rows,
                    { productId: row.productId, title: row.title, label: "" },
                  ]);
                }}
                className="h-auto min-h-11 px-0 text-sm text-accent disabled:opacity-40"
              >
                {copy.add}
              </Button>
            </li>
          ))}
        </ul>
        {candidates.candidates.length === 0 ? (
          <EmptyState title={copy.noCandidates} description={copy.noCandidatesHint} />
        ) : null}
        <nav aria-label={copy.candidates} className="flex items-center gap-4 text-sm text-accent">
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || loading || candidates.page <= 1}
            onClick={() => changePage(candidates.page - 1)}
            className="h-auto min-h-11 px-0 text-sm text-accent disabled:opacity-40"
          >
            {copy.previous}
          </Button>
          <span className="text-secondary">
            {copy.page} {candidates.page}
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || loading || !candidates.hasMore || candidates.page >= 1000}
            onClick={() => changePage(candidates.page + 1)}
            className="h-auto min-h-11 px-0 text-sm text-accent disabled:opacity-40"
          >
            {copy.next}
          </Button>
        </nav>
      </section>
      {base.group && (
        <form onSubmit={(event) => submit(event, "remove")} className="nexus-panel space-y-3 p-5">
          <h2 className="font-semibold text-primary">{copy.dissolve}</h2>
          <p className="text-sm text-secondary">{copy.dissolveNote}</p>
          <p className="text-xs text-muted">{copy.reason}</p>
          <label htmlFor={`${field}-remove-reason`} className="block text-sm text-secondary">
            {copy.reason}
          </label>
          <textarea
            id={`${field}-remove-reason`}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setDirty(true);
            }}
            minLength={5}
            maxLength={1000}
            required
            disabled={disabled}
            rows={3}
            className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
          />
          <ActionConfirmCheckbox
            id={`${field}-remove-confirm`}
            checked={confirmed}
            onCheckedChange={setConfirmed}
            required
            disabled={disabled}
            labelClassName="flex gap-3 text-sm text-secondary"
            checkboxClassName={actionConfirmCheckboxFocusClass}
          >
            {copy.confirm}
          </ActionConfirmCheckbox>
          <Button
            type="submit"
            variant="outline"
            disabled={blocked || !confirmed}
            className="min-h-11 border-danger text-danger disabled:opacity-40"
          >
            {copy.dissolve}
          </Button>
        </form>
      )}
      {newest && (
        <section aria-label={copy.variantsLatest} className="nexus-panel space-y-2 p-4 text-sm">
          <p>{copy.variantsChanged}</p>
          <p>{copy.variantsDraftHelp}</p>
          {newest.group ? (
            <>
              <p className="font-semibold">{newest.group.title}</p>
              <ul>
                {newest.group.variants.map((row) => (
                  <li key={row.productId} className="break-words">
                    {row.title} — {row.label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>{copy.variantsNone}</p>
          )}
          {newest.anchorProductId !== product.id ? (
            <p>{copy.variantsAnchorChanged}</p>
          ) : (
            (!needsCheck || checkedUsable) && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (!dirty) {
                    setTitle(newest.group?.title ?? product.title.slice(0, 80));
                    setSelected(
                      newest.group?.variants.map((row) => ({
                        productId: row.productId,
                        title: row.title,
                        label: row.label,
                      })) ?? [{ productId: product.id, title: product.title, label: copy.base }],
                    );
                  }
                  setBase(newest);
                  setObservedPropsVersion(managedVersion(managed));
                  setChecked(null);
                  setNeedsCheck(false);
                  setSaved(false);
                  setConfirmed(false);
                  setError("");
                }}
              >
                {copy.variantsUseLatest}
              </Button>
            )
          )}
        </section>
      )}
      {(needsCheck || saved) && !foreignActor && (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void checkSaved()}>
          {copy.variantsCheck}
        </Button>
      )}
      {error ? <ErrorState title={error} description={copy.actionFailedDescription} /> : null}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      )}
    </section>
  );
}
