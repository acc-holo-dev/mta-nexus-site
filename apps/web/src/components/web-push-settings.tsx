"use client";

import { useEffect, useId, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@nexus/ui";
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

export type BrowserPushSnapshot = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  hasLocalSubscription: boolean;
  keyMatches: boolean | null;
};

export function parsePushServerState(value: unknown): PushServerState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.configured !== "boolean" ||
    typeof record.subscribed !== "boolean" ||
    !(record.publicKey === null || typeof record.publicKey === "string")
  ) {
    return null;
  }
  return {
    configured: record.configured,
    publicKey: record.publicKey,
    subscribed: record.subscribed,
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

async function deleteStoredEndpoint(endpoint: string): Promise<boolean> {
  const response = await fetch("/api/notifications/push", {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  return response.ok && data?.success === true;
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

async function readEffectivePushStatus(publicKeyHint?: string | null): Promise<{
  status: Exclude<PushStatus, "loading" | "error">;
  publicKey: string | null;
}> {
  const capability = readBrowserPushCapability();
  if (!capability.supported) {
    return { status: "unsupported", publicKey: publicKeyHint ?? null };
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
  if (localSubscription && keyMatches === false) {
    await deleteStoredEndpoint(localSubscription.endpoint).catch(() => false);
    await localSubscription.unsubscribe().catch(() => false);
    return {
      status: derivePushStatus(
        {
          supported: true,
          permission: capability.permission,
          hasLocalSubscription: false,
          keyMatches: null,
        },
        { ...state, subscribed: false },
      ),
      publicKey: state.publicKey,
    };
  }
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
  };
}

export function WebPushSettings() {
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

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const effective = await readEffectivePushStatus();
        if (!active) return;
        setPublicKey(effective.publicKey);
        setStatus(effective.status);
      } catch {
        if (active) setStatus("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    if (!publicKey || pending) return;
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      let subscription = await registration.pushManager.getSubscription();
      if (
        subscription &&
        !matchesApplicationServerKey(subscription.options.applicationServerKey, publicKey)
      ) {
        await deleteStoredEndpoint(subscription.endpoint).catch(() => false);
        await subscription.unsubscribe().catch(() => false);
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
          body: JSON.stringify(value.toJSON()),
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
        await subscription.unsubscribe();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });
        persisted = await persistSubscription(subscription);
      }

      if (!persisted.response.ok || persisted.data?.success !== true) {
        if (persisted.response.status === 409) {
          await subscription.unsubscribe().catch(() => false);
        }
        throw new Error("push-enable");
      }
      const confirmed = await readEffectivePushStatus(publicKey);
      setPublicKey(confirmed.publicKey);
      setStatus(confirmed.status);
    } catch {
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  async function requestDisable() {
    if (pending) return;
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
    void disable();
  }

  async function disable() {
    if (pending) return;
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        if (!(await deleteStoredEndpoint(subscription.endpoint))) {
          throw new Error("push-disable");
        }
        await subscription.unsubscribe();
      }
      const confirmed = await readEffectivePushStatus(publicKey);
      setPublicKey(confirmed.publicKey);
      setStatus(confirmed.status === "enabled" ? "error" : confirmed.status);
    } catch {
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  const description =
    status === "unsupported"
      ? copy.webPushUnsupported
      : status === "unconfigured"
        ? copy.webPushUnconfigured
        : status === "denied"
          ? copy.webPushDenied
          : status === "enabled"
            ? copy.webPushEnabled
            : status === "error"
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
        <span
          role={status === "error" ? "alert" : "status"}
          aria-live={status === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          className="sr-only"
        >
          {description}
        </span>
      </div>
      {status === "enabled" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          isLoading={pending}
          aria-describedby={describedBy}
          onClick={() => void requestDisable()}
        >
          {copy.webPushDisable}
        </Button>
      ) : status === "disabled" ? (
        <Button
          type="button"
          size="sm"
          isLoading={pending}
          aria-describedby={describedBy}
          onClick={() => void enable()}
        >
          {copy.webPushEnable}
        </Button>
      ) : status === "loading" ? (
        <span aria-hidden="true" className="text-xs text-muted">
          {copy.webPushLoading}
        </span>
      ) : null}
    </section>
  );
}
