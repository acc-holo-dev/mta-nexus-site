"use client";

import { Button } from "@nexus/ui";
import { BellRing } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { notificationInboxCopy } from "../lib/notification-inbox-copy";
import { confirmAction } from "./confirm-action";
import { useNexusLocale } from "./locale-context";

type PushStatus =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "disabled"
  | "enabled"
  | "error";

export type PushServerState = {
  configured: boolean;
  publicKey: string | null;
  subscribed: boolean;
};
export type PushIdentity = { actorId: string; sessionId: string };

export type BrowserPushSnapshot = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  hasLocalSubscription: boolean;
  keyMatches: boolean | null;
};

export function parsePushServerState(value: unknown): (PushServerState & PushIdentity) | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.configured !== "boolean" ||
    typeof record.subscribed !== "boolean" ||
    typeof record.actorId !== "string" ||
    !record.actorId ||
    record.actorId.length > 128 ||
    record.actorId.trim() !== record.actorId ||
    typeof record.sessionId !== "string" ||
    !record.sessionId ||
    record.sessionId.length > 128 ||
    record.sessionId.trim() !== record.sessionId ||
    !(record.publicKey === null || typeof record.publicKey === "string")
  ) {
    return null;
  }
  return {
    configured: record.configured,
    publicKey: record.publicKey,
    subscribed: record.subscribed,
    actorId: record.actorId,
    sessionId: record.sessionId,
  };
}

export function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function matchesApplicationServerKey(
  current: ArrayBuffer | null | undefined,
  publicKey: string,
): boolean {
  if (!current) return false;
  const expected = applicationServerKey(publicKey);
  const actual = new Uint8Array(current);
  if (actual.length !== expected.length) return false;
  return actual.every((byte, index) => byte === expected[index]);
}

export async function endpointFingerprint(endpoint: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Read-only capability check; never requests Notification permission. */
export function readBrowserPushCapability(): Pick<BrowserPushSnapshot, "supported" | "permission"> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return { supported: false, permission: "unsupported" };
  }
  return { supported: true, permission: Notification.permission };
}

export function derivePushStatus(
  browser: BrowserPushSnapshot,
  server: PushServerState,
): Exclude<PushStatus, "loading" | "error"> {
  if (!browser.supported || browser.permission === "unsupported") return "unsupported";
  if (!server.configured || !server.publicKey) return "unconfigured";
  if (browser.permission === "denied") return "denied";
  if (browser.hasLocalSubscription && browser.keyMatches === false) return "disabled";
  if (server.subscribed && browser.hasLocalSubscription) return "enabled";
  return "disabled";
}

function sameIdentity(left: PushIdentity, right: PushIdentity): boolean {
  return left.actorId === right.actorId && left.sessionId === right.sessionId;
}

async function deleteStoredEndpoint(
  endpoint: string,
  identity: PushIdentity,
  requireRemoved = false,
): Promise<boolean> {
  const response = await fetch("/api/notifications/push", {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint,
      expectedActorId: identity.actorId,
      expectedSessionId: identity.sessionId,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  return (
    response.ok &&
    data?.success === true &&
    sameIdentity(data, identity) &&
    (!requireRemoved || data.removed === true)
  );
}

async function ensureUnsubscribed(subscription: PushSubscription, manager: PushManager) {
  if (await subscription.unsubscribe()) return;
  // A browser may return false when the subscription was already removed.
  const remaining = await manager.getSubscription();
  if (remaining?.endpoint === subscription.endpoint) throw new Error("push-unsubscribe");
}

async function readPushState(endpoint?: string) {
  const endpointHash = endpoint ? await endpointFingerprint(endpoint) : null;
  const url = endpointHash
    ? `/api/notifications/push?endpointHash=${endpointHash}`
    : "/api/notifications/push";
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  const state = parsePushServerState(data);
  if (!response.ok || !state) throw new Error("push-state");
  return state;
}

async function ensureCurrentIdentity(identity: PushIdentity) {
  const state = await readPushState();
  if (!sameIdentity(state, identity)) throw new Error("push-identity-changed");
}

async function readEffectivePushStatus(publicKeyHint?: string | null): Promise<{
  status: Exclude<PushStatus, "loading" | "error">;
  publicKey: string | null;
  identity: PushIdentity | null;
  unregisteredLocal: boolean;
}> {
  const capability = readBrowserPushCapability();
  if (!capability.supported) {
    return {
      status: "unsupported",
      publicKey: publicKeyHint ?? null,
      identity: null,
      unregisteredLocal: false,
    };
  }
  const registration = await navigator.serviceWorker.getRegistration("/");
  const localSubscription = await registration?.pushManager.getSubscription();
  const state = await readPushState(localSubscription?.endpoint);
  const keyMatches =
    localSubscription && state.publicKey
      ? matchesApplicationServerKey(localSubscription.options.applicationServerKey, state.publicKey)
      : localSubscription
        ? false
        : null;
  return {
    status: derivePushStatus(
      {
        supported: true,
        permission: capability.permission,
        hasLocalSubscription: Boolean(localSubscription),
        keyMatches,
      },
      state,
    ),
    publicKey: state.publicKey,
    identity: { actorId: state.actorId, sessionId: state.sessionId },
    unregisteredLocal: Boolean(localSubscription) && !state.subscribed,
  };
}

export function WebPushSettings({ expectedIdentity }: { expectedIdentity: PushIdentity | null }) {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.settings;
  const openBetaNote = notificationInboxCopy(locale).openBetaNote;
  const titleId = useId();
  const descriptionId = useId();
  const openBetaNoteId = useId();
  const describedBy = `${descriptionId} ${openBetaNoteId}`;
  const [status, setStatus] = useState<PushStatus>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [identity, setIdentity] = useState<PushIdentity | null>(null);
  const [unregisteredLocal, setUnregisteredLocal] = useState(false);
  const expectedActorId = expectedIdentity?.actorId;
  const expectedSessionId = expectedIdentity?.sessionId;

  // biome-ignore lint/correctness/useExhaustiveDependencies(attempt): Retry restarts the state check.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const effective = await readEffectivePushStatus();
        if (!active) return;
        if (
          !expectedActorId ||
          !expectedSessionId ||
          (effective.identity &&
            !sameIdentity(effective.identity, {
              actorId: expectedActorId,
              sessionId: expectedSessionId,
            }))
        ) {
          throw new Error("push-identity-changed");
        }
        setPublicKey(effective.publicKey);
        setIdentity(effective.identity);
        setUnregisteredLocal(effective.unregisteredLocal);
        setStatus(effective.status);
      } catch {
        if (active) {
          setIdentity(null);
          setStatus("error");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [attempt, expectedActorId, expectedSessionId]);

  const identityMatchesParent = Boolean(
    identity && expectedIdentity && sameIdentity(identity, expectedIdentity),
  );
  const shownStatus = identity && !identityMatchesParent ? "error" : status;

  async function enable() {
    if (!publicKey || !identity || !identityMatchesParent || pending) return;
    setPending(true);
    try {
      // Preserve the browser's user activation for the permission prompt.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        return;
      }
      await ensureCurrentIdentity(identity);
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await ensureCurrentIdentity(identity);
      let subscription = await registration.pushManager.getSubscription();
      if (
        subscription &&
        !matchesApplicationServerKey(subscription.options.applicationServerKey, publicKey)
      ) {
        if (!(await deleteStoredEndpoint(subscription.endpoint, identity)))
          throw new Error("push-cleanup");
        await ensureCurrentIdentity(identity);
        await ensureUnsubscribed(subscription, registration.pushManager);
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });
      }
      const persistSubscription = async (value: PushSubscription) => {
        const response = await fetch("/api/notifications/push", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...value.toJSON(),
            expectedActorId: identity.actorId,
            expectedSessionId: identity.sessionId,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        return {
          response,
          data: await response.json().catch(() => null),
        };
      };

      let persisted = await persistSubscription(subscription);
      if (
        persisted.response.status === 409 &&
        persisted.data?.code === "WEB_PUSH_ENDPOINT_CONFLICT"
      ) {
        await ensureCurrentIdentity(identity);
        await ensureUnsubscribed(subscription, registration.pushManager);
        await ensureCurrentIdentity(identity);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });
        persisted = await persistSubscription(subscription);
      }

      if (
        !persisted.response.ok ||
        persisted.data?.success !== true ||
        !sameIdentity(persisted.data, identity)
      ) {
        if (
          persisted.response.status === 409 &&
          persisted.data?.code === "WEB_PUSH_ENDPOINT_CONFLICT"
        ) {
          await ensureCurrentIdentity(identity);
          await subscription.unsubscribe().catch(() => false);
        }
        throw new Error("push-enable");
      }
      const confirmed = await readEffectivePushStatus(publicKey);
      if (!confirmed.identity || !sameIdentity(confirmed.identity, identity))
        throw new Error("push-identity-changed");
      setPublicKey(confirmed.publicKey);
      setUnregisteredLocal(confirmed.unregisteredLocal);
      setStatus(confirmed.status);
    } catch {
      setIdentity(null);
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  async function requestDisable() {
    if (pending || !identity || !identityMatchesParent) return;
    const expectedIdentity = identity;
    if (
      !(await confirmAction({
        title: copy.webPushDisableConfirmTitle,
        object: copy.webPush,
        consequences: copy.webPushDisableConfirm,
        confirmLabel: copy.webPushDisable,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      }))
    )
      return;
    void disable(expectedIdentity);
  }

  async function disable(expectedIdentity: PushIdentity) {
    if (pending) return;
    setPending(true);
    try {
      await ensureCurrentIdentity(expectedIdentity);
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        if (!(await deleteStoredEndpoint(subscription.endpoint, expectedIdentity, true))) {
          throw new Error("push-disable");
        }
        if (!registration) throw new Error("push-disable");
        await ensureCurrentIdentity(expectedIdentity);
        await ensureUnsubscribed(subscription, registration.pushManager);
      }
      const confirmed = await readEffectivePushStatus(publicKey);
      if (!confirmed.identity || !sameIdentity(confirmed.identity, expectedIdentity))
        throw new Error("push-identity-changed");
      setPublicKey(confirmed.publicKey);
      setUnregisteredLocal(confirmed.unregisteredLocal);
      setStatus(confirmed.status === "enabled" ? "error" : confirmed.status);
    } catch {
      setIdentity(null);
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  const description =
    shownStatus === "unsupported"
      ? copy.webPushUnsupported
      : shownStatus === "unconfigured"
        ? copy.webPushUnconfigured
        : shownStatus === "denied"
          ? copy.webPushDenied
          : shownStatus === "enabled"
            ? copy.webPushEnabled
            : shownStatus === "error"
              ? copy.webPushError
              : copy.webPushDescription;

  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-base bg-inset p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <h3 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-primary">
          <BellRing className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>{copy.webPush}</span>
        </h3>
        <p id={descriptionId} className="mt-1 text-xs text-muted">
          {description}
        </p>
        <p id={openBetaNoteId} className="mt-1 text-xs text-muted">
          {openBetaNote}
        </p>
        {shownStatus === "disabled" && unregisteredLocal && (
          <p className="mt-1 text-xs text-muted">{copy.webPushCleanupHint}</p>
        )}
        <span
          role={shownStatus === "error" ? "alert" : "status"}
          aria-live={shownStatus === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          className="sr-only"
        >
          {description}
        </span>
      </div>
      {shownStatus === "enabled" ? (
        <Button
          type="button"
          size="touch"
          variant="outline"
          isLoading={pending}
          aria-describedby={describedBy}
          onClick={() => void requestDisable()}
        >
          {copy.webPushDisable}
        </Button>
      ) : shownStatus === "disabled" ? (
        <Button
          type="button"
          size="touch"
          isLoading={pending}
          aria-describedby={describedBy}
          onClick={() => void enable()}
        >
          {copy.webPushEnable}
        </Button>
      ) : shownStatus === "error" ? (
        <Button
          type="button"
          size="touch"
          variant="outline"
          aria-describedby={describedBy}
          onClick={() => {
            setStatus("loading");
            setAttempt((value) => value + 1);
          }}
        >
          {copy.retry}
        </Button>
      ) : shownStatus === "loading" ? (
        <span aria-hidden="true" className="text-xs text-muted">
          {copy.webPushLoading}
        </span>
      ) : null}
    </section>
  );
}
