"use client";
import { Button, ErrorState, Input } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { storageMaintenanceCopy } from "../lib/storage-maintenance-i18n";
import { ActionConfirmCheckbox, actionConfirmCheckboxFocusClass } from "./action-confirm-checkbox";

async function json(url: string, actorId: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(url, {
    ...privateApiRequest({
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined ? {} : { json: body }),
      signal,
      timeoutMs: 60000,
    }),
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      "x-nexus-actor-id": actorId,
    },
  });
  const value = await response.json().catch(() => null);
  if (!response.ok || value?.actorId !== actorId) throw new Error("Storage request failed");
  return value;
}
export function StorageDiscoveryControls({ locale, actorId }: { locale: string; actorId: string }) {
  const copy = storageMaintenanceCopy(locale),
    router = useRouter();
  const [ownerId, setOwner] = useState(""),
    [offset, setOffset] = useState(0),
    [namespaceOffset, setNamespaceOffset] = useState(0),
    [owners, setOwners] = useState<string[]>([]),
    [nextNamespaces, setNextNamespaces] = useState<number | null>(null),
    [nextObjects, setNextObjects] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const lock = useRef(false),
    epoch = useRef(0),
    current = useRef(actorId),
    ready = useRef(actorId),
    controller = useRef<AbortController | null>(null);
  if (current.current !== actorId) {
    current.current = actorId;
    epoch.current++;
  }
  useEffect(() => {
    ready.current = actorId;
    lock.current = false;
    controller.current?.abort();
    setOwner("");
    setOffset(0);
    setNamespaceOffset(0);
    setOwners([]);
    setNextNamespaces(null);
    setNextObjects(null);
    setPending(false);
    setMessage("");
    setError(false);
    return () => {
      epoch.current++;
      controller.current?.abort();
    };
  }, [actorId]);
  async function run(kind: "namespaces" | "discover", next?: number) {
    if (lock.current || pending || ready.current !== actorId || current.current !== actorId) return;
    const version = epoch.current,
      abort = new AbortController();
    controller.current = abort;
    lock.current = true;
    setPending(true);
    setError(false);
    setMessage("");
    try {
      if (kind === "namespaces") {
        const position = next ?? namespaceOffset;
        const result = await json(
          `/api/admin/storage/namespaces?offset=${position}`,
          actorId,
          abort.signal,
        );
        if (version !== epoch.current || abort.signal.aborted) return;
        if (
          !Array.isArray(result.owners) ||
          !result.owners.every((owner: unknown) => typeof owner === "string") ||
          !(result.nextOffset === null || Number.isSafeInteger(result.nextOffset))
        )
          throw new Error("Invalid response");
        setOwners(result.owners);
        setNamespaceOffset(position);
        setNextNamespaces(result.nextOffset);
        if (result.limited) setMessage(copy.limit);
      } else {
        const position = next ?? offset;
        const result = await json("/api/admin/storage/discovery", actorId, abort.signal, {
          ownerId,
          offset: position,
        });
        if (version !== epoch.current || abort.signal.aborted) return;
        if (
          !Number.isSafeInteger(result.observed) ||
          !Number.isSafeInteger(result.skipped) ||
          !(result.nextOffset === null || Number.isSafeInteger(result.nextOffset)) ||
          typeof result.limited !== "boolean"
        )
          throw new Error("Invalid response");
        setOffset(position);
        setNextObjects(result.nextOffset);
        setMessage(
          `${copy.discovered}: ${result.observed}; ${copy.skipped}: ${result.skipped}${result.limited ? ` · ${copy.limit}` : ""}`,
        );
        router.refresh();
      }
    } catch {
      if (version === epoch.current && !abort.signal.aborted) setError(true);
    } finally {
      if (version === epoch.current) {
        lock.current = false;
        setPending(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  }
  if (ready.current !== actorId) return null;
  return (
    <section className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-4">
      <h2>{copy.discovery}</h2>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => void run("namespaces")}
        >
          {copy.namespaces}
        </Button>
        {nextNamespaces !== null && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => void run("namespaces", nextNamespaces)}
          >
            {copy.nextWindow}
          </Button>
        )}
      </div>
      {owners.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {owners.map((owner) => (
            <li key={owner}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-h-11 px-0 text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                disabled={pending}
                onClick={() => {
                  setOwner(owner);
                  setOffset(0);
                  setNextObjects(null);
                }}
              >
                {owner}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run("discover");
        }}
      >
        <div className="min-w-48 flex-1">
          <Input
            label={copy.owner}
            required
            pattern="[A-Za-z0-9_-]{1,128}"
            value={ownerId}
            maxLength={128}
            disabled={pending}
            onChange={(event) => {
              setOwner(event.target.value);
              setOffset(0);
              setNextObjects(null);
            }}
          />
        </div>
        <div className="w-28">
          <Input
            label={copy.offset}
            required
            type="number"
            min={0}
            max={10000}
            step={1}
            value={offset}
            disabled={pending}
            onChange={(event) => {
              setOffset(Number(event.target.value));
              setNextObjects(null);
            }}
          />
        </div>
        <Button type="submit" disabled={pending} isLoading={pending} className="min-h-11">
          {pending ? copy.busy : copy.discover}
        </Button>
        {nextObjects !== null && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => void run("discover", nextObjects)}
          >
            {copy.nextWindow}
          </Button>
        )}
      </form>
      <p role="status">{message}</p>
      {error ? <ErrorState title={copy.error} description={copy.formErrorHint} /> : null}
    </section>
  );
}
export function StorageCleanupControls({
  id,
  actorId,
  revision,
  locale,
}: {
  id: string;
  actorId: string;
  revision: number;
  locale: string;
}) {
  const copy = storageMaintenanceCopy(locale),
    router = useRouter();
  const [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(false),
    [blocked, setBlocked] = useState(false);
  const scope = `${actorId}:${id}:${revision}`;
  const current = useRef(scope),
    ready = useRef(scope),
    epoch = useRef(0),
    lock = useRef(false),
    controller = useRef<AbortController | null>(null);
  if (current.current !== scope) {
    current.current = scope;
    epoch.current++;
  }
  useEffect(() => {
    ready.current = scope;
    lock.current = false;
    controller.current?.abort();
    setConfirmed(false);
    setPending(false);
    setError(false);
    setBlocked(false);
    return () => {
      epoch.current++;
      controller.current?.abort();
    };
  }, [scope]);
  async function cleanup() {
    if (
      !confirmed ||
      pending ||
      blocked ||
      lock.current ||
      ready.current !== scope ||
      current.current !== scope
    )
      return;
    const version = epoch.current,
      abort = new AbortController();
    controller.current = abort;
    lock.current = true;
    setPending(true);
    setError(false);
    try {
      const result = await json(
        `/api/admin/storage/objects/${encodeURIComponent(id)}/cleanup`,
        actorId,
        abort.signal,
        {
          expectedRevision: revision,
          confirmation: "delete_unreferenced",
        },
      );
      if (version !== epoch.current || abort.signal.aborted) return;
      if (!["deleted", "missing", "changed", "failed"].includes(result.state))
        throw new Error("Invalid response");
      setConfirmed(false);
      if (result.state === "failed") setError(true);
      router.refresh();
    } catch {
      if (version === epoch.current && !abort.signal.aborted) {
        setError(true);
        setBlocked(true);
      }
    } finally {
      if (version === epoch.current) {
        lock.current = false;
        setPending(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  }
  if (ready.current !== scope) return null;
  return (
    <section className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-4">
      <p>{copy.cleanupNote}</p>
      <ActionConfirmCheckbox
        id="storage-maintenance-cleanup-confirm"
        checked={confirmed}
        onCheckedChange={setConfirmed}
        disabled={pending}
        labelClassName="flex min-h-11 gap-2"
        checkboxClassName={actionConfirmCheckboxFocusClass}
      >
        {copy.confirm}
      </ActionConfirmCheckbox>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="danger"
          className="min-h-11"
          disabled={!confirmed || pending || blocked}
          isLoading={pending}
          onClick={() => void cleanup()}
        >
          {pending ? copy.busy : copy.cleanup}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => {
            setConfirmed(false);
            if (blocked) window.location.reload();
            else router.refresh();
          }}
        >
          {copy.refresh}
        </Button>
      </div>
      {error ? <ErrorState title={copy.error} description={copy.formErrorHint} /> : null}
    </section>
  );
}
