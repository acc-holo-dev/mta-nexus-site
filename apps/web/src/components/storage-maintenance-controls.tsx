"use client";
import { Button, ErrorState, Input } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { storageMaintenanceCopy } from "../lib/storage-maintenance-i18n";
import { ActionConfirmCheckbox, actionConfirmCheckboxFocusClass } from "./action-confirm-checkbox";

async function json(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Storage request failed");
  return response.json();
}
export function StorageDiscoveryControls({ locale }: { locale: string }) {
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
  async function run(kind: "namespaces" | "discover", next?: number) {
    if (pending) return;
    setPending(true);
    setError(false);
    setMessage("");
    try {
      if (kind === "namespaces") {
        const position = next ?? namespaceOffset;
        const result = await json(`/api/admin/storage/namespaces?offset=${position}`);
        setOwners(result.owners);
        setNamespaceOffset(position);
        setNextNamespaces(result.nextOffset);
        if (result.limited) setMessage(copy.limit);
      } else {
        const position = next ?? offset;
        const result = await json("/api/admin/storage/discovery", { ownerId, offset: position });
        setOffset(position);
        setNextObjects(result.nextOffset);
        setMessage(
          `${copy.discovered}: ${result.observed}; ${copy.skipped}: ${result.skipped}${result.limited ? ` · ${copy.limit}` : ""}`,
        );
        router.refresh();
      }
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
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
  revision,
  locale,
}: {
  id: string;
  revision: number;
  locale: string;
}) {
  const copy = storageMaintenanceCopy(locale),
    router = useRouter();
  const [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  async function cleanup() {
    if (!confirmed || pending) return;
    setPending(true);
    setError(false);
    try {
      await json(`/api/admin/storage/objects/${encodeURIComponent(id)}/cleanup`, {
        expectedRevision: revision,
        confirmation: "delete_unreferenced",
      });
      setConfirmed(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
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
          disabled={!confirmed || pending}
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
            router.refresh();
          }}
        >
          {copy.refresh}
        </Button>
      </div>
      {error ? <ErrorState title={copy.error} description={copy.formErrorHint} /> : null}
    </section>
  );
}
