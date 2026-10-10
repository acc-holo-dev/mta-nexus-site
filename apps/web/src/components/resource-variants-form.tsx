"use client";
import { type ManagedResourceVariants, RESOURCE_VARIANT_LIMIT } from "@nexus/domain";
import { resourceVariantCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedVariantCommand } from "../lib/resource-management-confirmation";
import {
  getResourceManagementCopy,
  resourceManagementError,
} from "../lib/resource-management-i18n";
import { useNexusLocale } from "./locale-context";

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
export function ResourceVariantsForm({
  product,
  managed,
  initialCandidates,
}: {
  product: { id: string; title: string };
  managed: ManagedResourceVariants;
  initialCandidates: CandidatePage;
}) {
  const { locale } = useNexusLocale(),
    copy = getResourceManagementCopy(locale),
    router = useRouter();
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
  const disabled = busy || saved;
  async function changePage(page: number) {
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
        setError(resourceManagementError(locale, body?.code));
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
    if (lock.current || disabled || (action === "remove" && !confirmed)) return;
    const parsed = resourceVariantCommandSchema.safeParse(
      action === "save"
        ? {
            action,
            expectedGroupId: managed.group?.id ?? null,
            expectedRevision: managed.group?.revision ?? 0,
            title,
            variants: selected.map(({ productId, label }) => ({ productId, label })),
            reason,
          }
        : {
            action,
            expectedGroupId: managed.group?.id,
            expectedRevision: managed.group?.revision,
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
      const response = await fetch(
        `/api/products/${product.id}/variants`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !confirmedVariantCommand(body, product.id, parsed.data)) {
        setError(resourceManagementError(locale, body?.code));
        if (response.status === 409) router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
    } finally {
      lock.current = false;
      setBusy(false);
    }
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
          onChange={(event) => setTitle(event.target.value)}
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
                onChange={(event) =>
                  setSelected((rows) =>
                    rows.map((value) =>
                      value.productId === row.productId
                        ? { ...value, label: event.target.value }
                        : value,
                    ),
                  )
                }
                className="my-2 w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
              />
              <div className="flex flex-wrap gap-4 text-xs text-accent">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  aria-label={`${copy.up}: ${row.title}`}
                  onClick={() => move(index, -1)}
                  className="disabled:opacity-40"
                >
                  {copy.up}
                </button>
                <button
                  type="button"
                  disabled={disabled || index === selected.length - 1}
                  aria-label={`${copy.down}: ${row.title}`}
                  onClick={() => move(index, 1)}
                  className="disabled:opacity-40"
                >
                  {copy.down}
                </button>
                <button
                  type="button"
                  disabled={disabled || row.productId === product.id}
                  aria-label={`${copy.remove}: ${row.title}`}
                  onClick={() =>
                    setSelected((rows) => rows.filter((value) => value.productId !== row.productId))
                  }
                  className="disabled:opacity-40"
                >
                  {copy.remove}
                </button>
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
          onChange={(event) => setReason(event.target.value)}
          className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? copy.working : copy.save}
        </button>
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
              <button
                type="button"
                disabled={
                  disabled ||
                  selected.length >= RESOURCE_VARIANT_LIMIT ||
                  selected.some((value) => value.productId === row.productId)
                }
                aria-label={`${copy.add}: ${row.title}`}
                onClick={() =>
                  setSelected((rows) => [
                    ...rows,
                    { productId: row.productId, title: row.title, label: "" },
                  ])
                }
                className="text-sm text-accent disabled:opacity-40"
              >
                {copy.add}
              </button>
            </li>
          ))}
        </ul>
        {candidates.candidates.length === 0 && (
          <p className="text-sm text-muted">{copy.noCandidates}</p>
        )}
        <nav aria-label={copy.candidates} className="flex items-center gap-4 text-sm text-accent">
          <button
            type="button"
            disabled={disabled || loading || candidates.page <= 1}
            onClick={() => changePage(candidates.page - 1)}
            className="disabled:opacity-40"
          >
            {copy.previous}
          </button>
          <span className="text-secondary">
            {copy.page} {candidates.page}
          </span>
          <button
            type="button"
            disabled={disabled || loading || !candidates.hasMore || candidates.page >= 1000}
            onClick={() => changePage(candidates.page + 1)}
            className="disabled:opacity-40"
          >
            {copy.next}
          </button>
        </nav>
      </section>
      {managed.group && (
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
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={1000}
            required
            disabled={disabled}
            rows={3}
            className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
          />
          <label className="flex gap-3 text-sm text-secondary">
            <input
              type="checkbox"
              checked={confirmed}
              required
              disabled={disabled}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {copy.confirm}
          </label>
          <button
            type="submit"
            disabled={disabled || !confirmed}
            className="rounded-lg border border-danger px-4 py-2 text-danger disabled:opacity-40"
          >
            {copy.dissolve}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      )}
    </section>
  );
}
