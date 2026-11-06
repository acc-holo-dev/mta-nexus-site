"use client";
import type {
  LibraryCollectionCommand,
  LibraryCollectionCopyPreview,
  LibraryCollectionSnapshot,
} from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { libraryCollectionCommandSchema, libraryCollectionSnapshotSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { confirmedCollectionCommand } from "../lib/library-collections-confirmation";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmAction } from "./confirm-action";
export function LibraryCollectionCommandForm({
  locale,
  actorId,
  collection,
  action = "create",
  productId,
  copyPreview,
  returnHref,
}: {
  locale: "ru" | "en";
  actorId: string;
  collection?: LibraryCollectionSnapshot;
  action?: Exclude<
    LibraryCollectionCommand["action"],
    "add-many" | "remove-many" | "copy-items" | "move-items" | "reconcile-items"
  >;
  productId?: string;
  copyPreview?: LibraryCollectionCopyPreview;
  returnHref?: string;
}) {
  const c = libraryCollectionsCopy(locale),
    router = useRouter(),
    field = useId();
  const pending = useRef<{
      command: LibraryCollectionCommand;
      collection?: LibraryCollectionSnapshot;
      endpoint: string;
      reloadHref: string;
    } | null>(null),
    lock = useRef(false),
    confirming = useRef(false),
    settled = useRef(false),
    active = useRef(true),
    controller = useRef<AbortController | null>(null),
    identityEpoch = useRef(0),
    localeRef = useRef(locale);
  localeRef.current = locale;
  const renderScope = `${action}:${actorId}:${collection?.id ?? ""}`;
  const priorRenderScope = useRef(renderScope);
  if (priorRenderScope.current !== renderScope) {
    priorRenderScope.current = renderScope;
    identityEpoch.current += 1;
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const [name, setName] = useState(
      action === "rename" || action === "duplicate" ? (collection?.name ?? "") : "",
    ),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [saved, setSaved] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const requiresStoredIntent = action === "create" || action === "duplicate";
  const [createReady, setCreateReady] = useState(!requiresStoredIntent);
  const [readyActor, setReadyActor] = useState(requiresStoredIntent ? "" : actorId);
  const storageKey =
    action === "duplicate"
      ? `nexus:collection-duplicate:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(collection?.id ?? "")}`
      : `nexus:collection-create:v1:${encodeURIComponent(actorId)}`;
  useEffect(() => {
    if (!requiresStoredIntent) return;
    let alive = true;
    identityEpoch.current += 1;
    controller.current?.abort();
    pending.current = null;
    lock.current = false;
    confirming.current = false;
    settled.current = false;
    setName(action === "duplicate" ? (collection?.name ?? "") : "");
    setBusy(false);
    setFrozen(false);
    setSaved(false);
    setBlocked(false);
    setError("");
    setCreateReady(false);
    setReadyActor("");
    async function restore() {
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          if (raw.length > 10_000) throw new Error("storage");
          const item = JSON.parse(raw);
          const parsed = libraryCollectionCommandSchema.safeParse(item?.command);
          if (
            item?.actorId !== actorId ||
            !parsed.success ||
            parsed.data.action !== action ||
            (parsed.data.action !== "create" && parsed.data.action !== "duplicate")
          )
            throw new Error("storage");
          const source =
            parsed.data.action === "duplicate"
              ? libraryCollectionSnapshotSchema.safeParse(item?.collection)
              : null;
          if (
            parsed.data.action === "duplicate" &&
            (!source?.success ||
              source.data.id !== parsed.data.sourceCollectionId ||
              source.data.id !== collection?.id ||
              source.data.revision !== parsed.data.expectedRevision)
          )
            throw new Error("storage");
          if (alive) {
            pending.current = {
              command: parsed.data,
              ...(source?.success ? { collection: source.data } : {}),
              endpoint: "/api/library/collections",
              reloadHref: collectionHref(collection?.id),
            };
            setName(parsed.data.name);
            setFrozen(true);
          }
        }
        if (alive) {
          setReadyActor(actorId);
          setCreateReady(true);
        }
      } catch {
        if (alive)
          setError(
            localeRef.current === "ru"
              ? "Не удалось проверить сессию или восстановить коллекцию. Обновите страницу и войдите в исходный аккаунт."
              : "Could not check the session or restore the collection. Refresh and sign in to the original account.",
          );
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [action, actorId, storageKey, requiresStoredIntent, collection?.id, collection?.name]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !active.current ||
      lock.current ||
      confirming.current ||
      settled.current ||
      (requiresStoredIntent && (!createReady || readyActor !== actorId))
    )
      return;
    const operationEpoch = identityEpoch.current;
    const firstAttempt = !pending.current;
    if (
      !pending.current &&
      action === "duplicate" &&
      (!collection ||
        !copyPreview ||
        copyPreview.source.id !== collection.id ||
        copyPreview.source.name !== collection.name ||
        copyPreview.source.status !== collection.status ||
        copyPreview.source.revision !== collection.revision)
    ) {
      setError(c.invalid);
      return;
    }
    const parsed = libraryCollectionCommandSchema.safeParse(
      pending.current?.command ?? {
        requestId: crypto.randomUUID(),
        action,
        ...(action === "create" || action === "rename" || action === "duplicate" ? { name } : {}),
        ...(action !== "create" ? { expectedRevision: collection?.revision } : {}),
        ...(action === "add" || action === "remove" ? { productId } : {}),
        ...(action === "duplicate"
          ? {
              sourceCollectionId: copyPreview?.source.id,
              expectedItemCount: copyPreview?.itemCount,
              sourceDigest: copyPreview?.sourceDigest,
            }
          : {}),
      },
    );
    if (!parsed.success) {
      setError(c.invalid);
      return;
    }
    if (
      !pending.current &&
      (action === "archive" ||
        action === "duplicate" ||
        action === "restore" ||
        action === "remove")
    ) {
      confirming.current = true;
      let accepted = false;
      try {
        const title =
          action === "archive"
            ? c.archive
            : action === "duplicate"
              ? c.duplicate
              : action === "restore"
                ? c.restore
                : c.remove;
        const consequences =
          action === "archive"
            ? c.archiveConfirm
            : action === "duplicate"
              ? c.copyConfirm
              : action === "restore"
                ? c.restoreConfirm
                : c.removeConfirm;
        accepted = await confirmAction({
          title,
          object: collection?.name ?? name,
          consequences,
          confirmLabel: title,
          cancelLabel: c.back,
          closeLabel: c.back,
        });
      } catch {
        if (active.current && operationEpoch === identityEpoch.current) setError(c.retry);
      } finally {
        if (operationEpoch === identityEpoch.current) confirming.current = false;
      }
      if (!accepted || !active.current || operationEpoch !== identityEpoch.current) return;
    }
    if (requiresStoredIntent && firstAttempt) {
      try {
        const source =
          action === "duplicate" && collection
            ? {
                id: collection.id,
                name: collection.name,
                status: collection.status,
                revision: collection.revision,
              }
            : undefined;
        const raw = JSON.stringify({
          actorId,
          command: parsed.data,
          ...(source ? { collection: source } : {}),
        });
        sessionStorage.setItem(storageKey, raw);
        if (sessionStorage.getItem(storageKey) !== raw) throw new Error("storage");
      } catch {
        setError(
          locale === "ru"
            ? "Не удалось сохранить данные восстановления. Коллекция не отправлена."
            : "Could not save recovery data. The collection was not submitted.",
        );
        return;
      }
    }
    pending.current ??= {
      command: parsed.data,
      collection: collection
        ? {
            id: collection.id,
            name: collection.name,
            status: collection.status,
            revision: collection.revision,
          }
        : undefined,
      endpoint: `/api/library/collections${collection && action !== "duplicate" ? `/${encodeURIComponent(collection.id)}` : ""}`,
      reloadHref: returnHref ?? collectionHref(collection?.id),
    };
    const attempt = pending.current;
    const abort = new AbortController();
    controller.current = abort;
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    try {
      const response = await fetch(attempt.endpoint, {
        ...privateApiRequest({ method: "POST", json: attempt.command, signal: abort.signal }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null),
        id = response.ok
          ? confirmedCollectionCommand(body, attempt.command, attempt.collection)
          : null;
      if (!active.current || abort.signal.aborted || operationEpoch !== identityEpoch.current)
        return;
      if (!id) {
        if (requiresStoredIntent) {
          if (
            firstAttempt &&
            [400, 401, 403, 404, 409, 413, 415, 422, 428, 429].includes(response.status)
          ) {
            try {
              sessionStorage.removeItem(storageKey);
              if (sessionStorage.getItem(storageKey) !== null) throw new Error("storage");
              pending.current = null;
              setFrozen(false);
            } catch {
              setBlocked(true);
            }
          }
          if (response.status === 401 || body?.code === "ACTOR_CHANGED") setBlocked(true);
          setError(libraryCollectionError(locale, body?.code));
          return;
        }
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
        setError(libraryCollectionError(locale, body?.code));
        return;
      }
      if (requiresStoredIntent) {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* The exact replay remains safe. */
        }
      }
      settled.current = true;
      setSaved(true);
      if (attempt.command.action === "create" || attempt.command.action === "duplicate")
        router.push(collectionHref(id));
      router.refresh();
    } catch {
      if (active.current && !abort.signal.aborted && operationEpoch === identityEpoch.current)
        setError(c.retry);
    } finally {
      if (operationEpoch === identityEpoch.current) lock.current = false;
      if (active.current && !abort.signal.aborted && operationEpoch === identityEpoch.current)
        setBusy(false);
      if (controller.current === abort) controller.current = null;
    }
  }
  return (
    <>
      {requiresStoredIntent && (!createReady || readyActor !== actorId) && error ? (
        <ErrorState id="library-collection-command-unavailable" title={error} />
      ) : null}
      <form
        onSubmit={submit}
        className="space-y-3"
        hidden={requiresStoredIntent && (!createReady || readyActor !== actorId)}
        style={
          requiresStoredIntent && (!createReady || readyActor !== actorId)
            ? { display: "none" }
            : undefined
        }
      >
        {(action === "create" || action === "rename" || action === "duplicate") && (
          <label htmlFor={field} className="block space-y-1">
            <span className="text-sm">{c.name}</span>
            <input
              id={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              disabled={busy || frozen || saved}
              className="w-full rounded border border-base bg-surface p-2"
            />
          </label>
        )}
        <Button
          type="submit"
          disabled={busy || saved || blocked}
          variant="outline"
          className="min-h-11"
        >
          {busy
            ? c.busy
            : saved
              ? c.saved
              : blocked
                ? c.reload
                : frozen && error
                  ? c.retryAction
                  : c[action]}
        </Button>
        {frozen && !saved && (
          <p role="note" className="text-xs text-muted">
            {c.frozen}
          </p>
        )}
        {error ? (
          <ErrorState
            title={error}
            description={requiresStoredIntent && frozen ? c.retry : c.actionErrorDescription}
            action={
              <a
                href={pending.current?.reloadHref ?? returnHref ?? collectionHref(collection?.id)}
                className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {c.reload}
              </a>
            }
          />
        ) : null}
        {saved && (
          <p role="status" className="sr-only">
            {c.saved}
          </p>
        )}
      </form>
    </>
  );
}
