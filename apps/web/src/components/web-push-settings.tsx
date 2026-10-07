"use client";

import { useEffect, useId, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@nexus/ui";
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

export function parsePushServerState(value: unknown): PushServerState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.configured !== "boolean" ||
    typeof record.subscribed !== "boolean" ||
    !(
      record.publicKey === null ||
      typeof record.publicKey === "string"
    )
  ) {
    return null;
  }
  return {
    configured: record.configured,
    publicKey: record.publicKey,
    subscribed: record.subscribed,
  };
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function readPushState() {
  const response = await fetch("/api/notifications/push", {
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  const state = parsePushServerState(data);
  if (!response.ok || !state) throw new Error("push-state");
  return state;
}

export function WebPushSettings() {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.settings;
  const titleId = useId();
  const descriptionId = useId();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (active) setStatus("unsupported");
        return;
      }
      try {
        const state = await readPushState();
        if (!active) return;
        setPublicKey(state.publicKey);
        if (!state.configured || !state.publicKey) { setStatus("unconfigured"); return; }
        if (Notification.permission === "denied") { setStatus("denied"); return; }
        const registration = await navigator.serviceWorker.getRegistration("/");
        const localSubscription = await registration?.pushManager.getSubscription();
        setStatus(state.subscribed && localSubscription ? "enabled" : "disabled");
      } catch {
        if (active) setStatus("error");
      }
    }
    void load();
    return () => { active = false; };
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
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });
      }
      const response = await fetch("/api/notifications/push", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) throw new Error("push-enable");
      setStatus("enabled");
    } catch {
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    if (pending) return;
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/notifications/push", {
          method: "DELETE",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          signal: AbortSignal.timeout(15_000),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.success !== true) throw new Error("push-disable");
        await subscription.unsubscribe();
      }
      setStatus("disabled");
    } catch {
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  const description =
    status === "unsupported" ? copy.webPushUnsupported :
    status === "unconfigured" ? copy.webPushUnconfigured :
    status === "denied" ? copy.webPushDenied :
    status === "enabled" ? copy.webPushEnabled :
    status === "error" ? copy.webPushError :
    copy.webPushDescription;

  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-base bg-inset p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <h3
          id={titleId}
          className="flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <BellRing className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>{copy.webPush}</span>
        </h3>
        <p id={descriptionId} className="mt-1 text-xs text-muted">
          {description}
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
          aria-describedby={descriptionId}
          onClick={() => void disable()}
        >
          {copy.webPushDisable}
        </Button>
      ) : status === "disabled" ? (
        <Button
          type="button"
          size="sm"
          isLoading={pending}
          aria-describedby={descriptionId}
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
