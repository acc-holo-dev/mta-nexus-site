"use client";
import {
  LIBRARY_COLLECTION_BATCH_LIMIT,
  type LibraryCollectionSnapshot,
  type LibraryMembershipBatchCommand,
  type LibraryResourceCollections,
} from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { libraryMembershipBatchCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { ActionConfirmCheckbox } from "../../shell/action-confirm-checkbox";
import { linkAccentSmRounded, linkAccentTight } from "../../shell/link-shell";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { typeBreakAllXs, typeFlexStartGap3, typeSmSecondary } from "../../shell/type-shell";
import { libraryCollectionError, libraryCollectionsCopy } from "../library-collections-i18n";
import { collectionHref } from "../library-collections-query";
import { confirmedMembershipBatch } from "../library-membership-batch-confirmation";
import { libraryMembershipBatchesCopy } from "../library-membership-batches-i18n";
import { libraryMembershipHistoryCopy } from "../library-membership-history-i18n";
import { membershipHistoryHref } from "../library-membership-history-query";
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
    <form onSubmit={submit} className={panelSpace4P5}>
      <h2 className="font-semibold">{h.title}</h2>
      <p className={typeSmSecondary}>{h.note}</p>
      <p className="text-xs text-muted">{h.quota}</p>
      <code className={typeBreakAllXs}>
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
                  <label className={typeFlexStartGap3}>
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
                  {cannotAdd ? (
                    <ErrorState
                      id="library-membership-cannot-add"
                      title={h.cannotAdd}
                      description={h.cannotAddHint}
                    />
                  ) : null}
                  {readOnly &&
                    (collection.status === "archived" ? (
                      <p role="note" className="text-xs text-muted">
                        {c.archivedNote}
                      </p>
                    ) : (
                      <ErrorState
                        id="library-membership-revision-locked"
                        title={c.revisionLocked}
                        description={c.revisionLockedHint}
                      />
                    ))}
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
        <ActionConfirmCheckbox
          id={`${report.resource.productId}-membership-batch-confirm`}
          checked={checked}
          required
          onCheckedChange={(value) => {
            if (!pending.current && !lock.current && !settled.current)
              setAcknowledged(value ? fingerprint : "");
          }}
        >
          {h.confirm}
        </ActionConfirmCheckbox>
      </fieldset>
      <Button
        type="submit"
        disabled={
          busy ||
          blocked ||
          !!saved ||
          (!pending.current &&
            (!checked || !changed.length || changed.length > LIBRARY_COLLECTION_BATCH_LIMIT))
        }
        variant="outline"
        className="min-h-11"
      >
        {busy ? c.busy : saved ? c.saved : blocked ? c.reload : frozen ? c.retryAction : h.apply}
      </Button>
      {frozen && !saved ? (
        <ErrorState id="library-membership-batch-frozen" title={c.frozen} description={c.retry} />
      ) : null}
      {error ? (
        <ErrorState
          title={error}
          description={h.actionErrorDescription}
          action={
            <a
              href={`/workspace/library/${encodeURIComponent(pending.current?.productId ?? report.resource.productId)}/collections`}
              className={linkAccentSmRounded}
            >
              {c.reload}
            </a>
          }
        />
      ) : null}
      {saved && (
        <div className="space-y-2">
          <p role="status">{h.success}</p>
          <a href={membershipHistoryHref(saved.id)} className={linkAccentTight}>
            {libraryMembershipHistoryCopy(locale).detail}
          </a>
          <a
            href={`/workspace/library/${encodeURIComponent(pending.current?.productId ?? report.resource.productId)}/collections`}
            className={linkAccentTight}
          >
            {c.reload}
          </a>
          <code className={typeBreakAllXs}>
            {h.receipt}: {saved.id}
          </code>
          <ul className="space-y-2">
            {saved.children.map((child) => (
              <li key={child.id}>
                <a
                  href={collectionHref(child.collection.id, "history")}
                  className={linkAccentTight}
                >
                  {child.collection.name}
                </a>{" "}
                · {c.revision} {child.collection.revision}
                <code className={typeBreakAllXs}>
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
