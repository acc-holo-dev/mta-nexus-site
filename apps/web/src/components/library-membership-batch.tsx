"use client";
import { libraryMembershipHistoryCopy } from "../lib/library-membership-history-i18n";
import { membershipHistoryHref } from "../lib/library-membership-history-query";
import {
  LIBRARY_COLLECTION_BATCH_LIMIT,
  type LibraryResourceCollections,
  type LibraryMembershipBatchCommand,
  type LibraryCollectionSnapshot,
} from "@nexus/domain";
import { libraryMembershipBatchCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { confirmedMembershipBatch } from "../lib/library-membership-batch-confirmation";
import { libraryMembershipBatchesCopy } from "../lib/library-membership-batches-i18n";
import { libraryCollectionsCopy, libraryCollectionError } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { privateApiRequest } from "../lib/private-api-request";
export function LibraryMembershipBatchForm({
  report,
  locale,
}: {
  report: LibraryResourceCollections;
  locale: "ru" | "en";
}) {
  const c = libraryCollectionsCopy(locale),
    h = libraryMembershipBatchesCopy(locale),
    router = useRouter();
  const [desired, setDesired] = useState<Record<string, boolean>>({}),
    [acknowledged, setAcknowledged] = useState(""),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState<ReturnType<typeof confirmedMembershipBatch>>(null);
  const pending = useRef<{
      productId: string;
      command: LibraryMembershipBatchCommand;
      reviewed: LibraryCollectionSnapshot[];
      endpoint: string;
      refreshable: boolean;
    } | null>(null),
    lock = useRef(false),
    settled = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const fingerprint = JSON.stringify({
    productId: report.resource.productId,
    canAdd: report.resource.canAdd,
    itemLimit: report.itemLimit,
    collections: report.collections,
    desired,
  });
  const checked = !!pending.current || acknowledged === fingerprint;
  const changed = report.collections.filter(
    (collection) => (desired[collection.id] ?? collection.inCollection) !== collection.inCollection,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mounted.current || lock.current || settled.current) return;
    let attempt = pending.current;
    if (!attempt) {
      if (!checked || !changed.length) {
        setError(changed.length ? c.invalid : h.noChanges);
        return;
      }
      if (
        changed.some(
          (collection) =>
            collection.status !== "active" ||
            collection.revision >= 2147483647 ||
            (!collection.inCollection &&
              (!report.resource.canAdd || collection.itemCount >= report.itemLimit)),
        )
      ) {
        setError(c.forbidden);
        return;
      }
      const parsed = libraryMembershipBatchCommandSchema.safeParse({
        requestId: crypto.randomUUID(),
        changes: changed.map((collection) => ({
          collectionId: collection.id,
          expectedRevision: collection.revision,
          wasInCollection: collection.inCollection,
          inCollection: desired[collection.id],
        })),
      });
      if (!parsed.success) {
        setError(c.invalid);
        return;
      }
      attempt = {
        productId: report.resource.productId,
        command: parsed.data,
        reviewed: changed.map((collection) => ({
          id: collection.id,
          name: collection.name,
          status: collection.status,
          revision: collection.revision,
        })),
        endpoint: `/api/library/${encodeURIComponent(report.resource.productId)}/collections`,
        refreshable:
          report.resource.canAdd ||
          report.collections.some(
            (collection) =>
              collection.inCollection && !changed.some((change) => change.id === collection.id),
          ),
      };
      pending.current = attempt;
    }
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch(
        attempt.endpoint,
        privateApiRequest({
          method: "POST",
          json: attempt.command,
          signal: abort.signal,
          timeoutMs: 30000,
        }),
      );
      const body = await response.json().catch(() => null);
      if (!mounted.current || abort.signal.aborted) return;
      const receipt = response.ok
        ? confirmedMembershipBatch(body, attempt.productId, attempt.command, attempt.reviewed)
        : null;
      if (!receipt) {
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
        setError(libraryCollectionError(locale, body?.code));
        return;
      }
      settled.current = true;
      setSaved(receipt);
      if (attempt.refreshable) router.refresh();
    } catch {
      if (mounted.current && !abort.signal.aborted) setError(c.retry);
    } finally {
      lock.current = false;
      if (mounted.current && !abort.signal.aborted) setBusy(false);
      if (controller.current === abort) controller.current = null;
    }
  }
  if (!report.collections.length && !pending.current) return null;
  const changes =
    pending.current?.command.changes ??
    changed.map((collection) => ({
      collectionId: collection.id,
      expectedRevision: collection.revision,
      wasInCollection: collection.inCollection,
      inCollection: desired[collection.id] ?? collection.inCollection,
    }));
  return (
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5">
      <h2 className="font-semibold">{h.title}</h2>
      <p className="text-sm text-secondary">{h.note}</p>
      <p className="text-xs text-muted">{h.quota}</p>
      <code className="block break-all text-xs">
        {pending.current?.productId ?? report.resource.productId}
      </code>
      <p>
        {h.selected}: {changes.length} / {LIBRARY_COLLECTION_BATCH_LIMIT}
      </p>
      <fieldset disabled={busy || frozen || blocked || !!saved} className="space-y-3">
        <legend className="sr-only">{h.title}</legend>
        {!pending.current && (
          <ul className="space-y-3">
            {report.collections.map((collection) => {
              const value = desired[collection.id] ?? collection.inCollection,
                isChanged = value !== collection.inCollection;
              const readOnly = collection.status !== "active" || collection.revision >= 2147483647;
              const cannotAdd =
                !collection.inCollection &&
                !value &&
                (!report.resource.canAdd || collection.itemCount >= report.itemLimit);
              return (
                <li key={collection.id} className="space-y-1 border-t border-base pt-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={value}
                      disabled={
                        readOnly ||
                        cannotAdd ||
                        (!isChanged && changed.length >= LIBRARY_COLLECTION_BATCH_LIMIT)
                      }
                      onChange={(event) => {
                        if (pending.current || lock.current || settled.current) return;
                        const value = event.target.checked;
                        setDesired((previous) => ({ ...previous, [collection.id]: value }));
                        setAcknowledged("");
                        setError("");
                      }}
                    />
                    <span className="break-words">
                      {collection.name}
                      <span className="block text-xs text-muted">{h.desired}</span>
                    </span>
                  </label>
                  <p className="text-xs text-muted">
                    {c[collection.status]} · {c.revision} {collection.revision} · {c.items}:{" "}
                    {collection.itemCount}/{report.itemLimit} · {h.current}:{" "}
                    {collection.inCollection ? c.inCollection : c.notInCollection}
                  </p>
                  {cannotAdd && <p className="text-xs text-muted">{h.cannotAdd}</p>}
                  {readOnly && (
                    <p className="text-xs text-muted">
                      {collection.status === "archived" ? c.archivedNote : c.revisionLocked}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <ul className="space-y-2">
          {changes.map((change) => {
            const collection = (pending.current?.reviewed ?? report.collections).find(
              (collection) => collection.id === change.collectionId,
            );
            return (
              <li key={change.collectionId} className="break-words text-sm">
                {collection?.name ?? change.collectionId} · {change.inCollection ? c.add : c.remove}{" "}
                · {c.revision} {change.expectedRevision} → {change.expectedRevision + 1}
              </li>
            );
          })}
        </ul>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={checked}
            required
            onChange={(event) => {
              if (!pending.current && !lock.current && !settled.current)
                setAcknowledged(event.target.checked ? fingerprint : "");
            }}
          />
          {h.confirm}
        </label>
      </fieldset>
      <button
        type="submit"
        disabled={
          busy ||
          blocked ||
          !!saved ||
          (!pending.current &&
            (!checked || !changed.length || changed.length > LIBRARY_COLLECTION_BATCH_LIMIT))
        }
        className="rounded border border-base px-4 py-2 text-accent disabled:opacity-60"
      >
        {busy ? c.busy : saved ? c.saved : blocked ? c.reload : frozen ? c.retryAction : h.apply}
      </button>
      {frozen && !saved && (
        <p role="note" className="text-sm text-muted">
          {c.frozen}
        </p>
      )}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-warning">
            {error}
          </p>
          <a
            href={`/workspace/library/${encodeURIComponent(pending.current?.productId ?? report.resource.productId)}/collections`}
            className="text-accent underline"
          >
            {c.reload}
          </a>
        </div>
      )}
      {saved && (
        <div className="space-y-2">
          <p role="status">{h.success}</p>
          <a href={membershipHistoryHref(saved.id)} className="text-accent underline">
            {libraryMembershipHistoryCopy(locale).detail}
          </a>
          <a
            href={`/workspace/library/${encodeURIComponent(pending.current?.productId ?? report.resource.productId)}/collections`}
            className="text-accent underline"
          >
            {c.reload}
          </a>
          <code className="block break-all text-xs">
            {h.receipt}: {saved.id}
          </code>
          <ul className="space-y-2">
            {saved.children.map((child) => (
              <li key={child.id}>
                <a
                  href={collectionHref(child.collection.id, "history")}
                  className="text-accent underline"
                >
                  {child.collection.name}
                </a>{" "}
                · {c.revision} {child.collection.revision}
                <code className="block break-all text-xs">
                  {c.receipt}: {child.id}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
