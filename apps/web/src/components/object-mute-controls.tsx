"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useEffect, useRef, useState } from "react";
import type { FollowTargetType, ObjectMuteDuration } from "../lib/follow-workspace-contract";
import { followCopy, followError } from "../lib/follow-workspace-copy";
import type { Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { useNexusLocale } from "./locale-context";

/**
 * Temporary notice mute for a followable object. Independent of follow/unfollow
 * and release-watch; security notices are never muted this way.
 */
export function ObjectMuteControls({
  targetType,
  targetId,
  actorId,
  locale: providedLocale,
  initial,
}: {
  targetType: FollowTargetType;
  targetId: string;
  actorId: string;
  locale?: Locale;
  initial?: { muted: boolean; mutedUntil: string | null };
}) {
  const { locale: appLocale } = useNexusLocale();
  const locale = providedLocale ?? appLocale;
  const copy = followCopy(locale);
  const [muted, setMuted] = useState(Boolean(initial?.muted));
  const [mutedUntil, setMutedUntil] = useState<string | null>(initial?.mutedUntil ?? null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(Boolean(initial));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (initial) return;
    let active = true;
    fetch(
      `/api/object-mute?${new URLSearchParams({ targetType, targetId })}`,
      privateApiRequest({ timeoutMs: 15_000 }),
    )
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok || typeof data?.muted !== "boolean") {
          setError(followError(locale, data?.code));
          setReady(true);
          return;
        }
        setMuted(Boolean(data.muted));
        setMutedUntil(typeof data.mutedUntil === "string" ? data.mutedUntil : null);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError(followError(locale, "UNCONFIRMED"));
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [targetType, targetId, initial, locale]);

  async function mutateMute(duration: ObjectMuteDuration | null) {
    if (!alive.current || busy.current || !ready) return;
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        "/api/object-mute",
        privateApiRequest({
          method: "POST",
          timeoutMs: 15_000,
          json: {
            targetType,
            targetId,
            duration,
            expectedActorId: actorId,
          },
        }),
      );
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (!response.ok || typeof data?.muted !== "boolean") {
        setError(followError(locale, data?.code));
        return;
      }
      setMuted(Boolean(data.muted));
      setMutedUntil(typeof data.mutedUntil === "string" ? data.mutedUntil : null);
      setMessage(copy.muteSuccess);
    } catch {
      if (alive.current) setError(followError(locale, "UNCONFIRMED"));
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">{copy.muteHelp}</p>
      {muted && mutedUntil ? (
        <p role="status" className="text-xs text-secondary">
          {copy.mutedUntil}:{" "}
          {new Date(mutedUntil).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(["24h", "7d", "30d"] as const).map((duration) => (
          <Button
            key={duration}
            type="button"
            variant="outline"
            className="min-h-11 text-xs"
            disabled={pending || !ready}
            onClick={() => void mutateMute(duration)}
          >
            {duration === "24h" ? copy.mute24h : duration === "7d" ? copy.mute7d : copy.mute30d}
          </Button>
        ))}
        {muted ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 text-xs"
            disabled={pending || !ready}
            onClick={() => void mutateMute(null)}
          >
            {copy.unmute}
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="max-w-sm text-xs text-success">
          {message}
        </p>
      ) : null}
      {error ? <ErrorState title={error} className="items-stretch py-2" /> : null}
    </div>
  );
}
