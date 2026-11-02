"use client";
import { Button } from "@nexus/ui";
import { Bell, BellOff, Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmsFollowMutation } from "../lib/follow-confirmation";
import type { ObjectMuteDuration } from "../lib/follow-workspace-contract";
import { followCopy, followError } from "../lib/follow-workspace-copy";
import { getDictionary, type Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
import { GuestAuthLinks } from "./guest-auth-links";
import { LocaleProvider, useNexusLocale } from "./locale-context";

type ContentFollowState = {
  authenticated: boolean;
  following: boolean;
  notifyComments: boolean;
  muted: boolean;
  mutedUntil: string | null;
  error?: boolean;
};

export function ContentFollowControls(props: {
  contentId: string;
  title: string;
  locale?: Locale;
  initial?: ContentFollowState;
}) {
  const control = <ContentFollowControl key={props.contentId} {...props} />;
  return props.locale ? <LocaleProvider locale={props.locale}>{control}</LocaleProvider> : control;
}

function ContentFollowControl({
  contentId,
  title,
  initial,
  locale: providedLocale,
}: {
  contentId: string;
  title: string;
  initial?: ContentFollowState;
  locale?: Locale;
}) {
  const { locale: appLocale } = useNexusLocale();
  const locale = providedLocale ?? appLocale;
  const copy = followCopy(locale);
  const workspace = getDictionary(locale).workspace;
  const pathname = usePathname();
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const [registerHref, setRegisterHref] = useState(() => authEntryHref("register", pathname));
  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh auth return paths after client navigation.
  useEffect(() => {
    const path = currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [pathname]);
  const [authenticated, setAuthenticated] = useState(initial?.authenticated ?? false);
  const [following, setFollowing] = useState(initial?.following ?? false);
  const [notifyComments, setNotifyComments] = useState(initial?.notifyComments ?? false);
  const [muted, setMuted] = useState(initial?.muted ?? false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(initial?.mutedUntil ?? null);
  const [ready, setReady] = useState(!!initial && !initial.error);
  const [failed, setFailed] = useState(!!initial?.error);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  const write = useRef<AbortController | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      write.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (initial && attempt === 0 && !initial.error) return;
    let active = true;
    const controller = new AbortController();
    setReady(false);
    setFailed(false);
    fetch(
      `/api/follow?${new URLSearchParams({ targetType: "content", targetId: contentId })}`,
      privateApiRequest({ signal: controller.signal, timeoutMs: 15_000 }),
    )
      .then(async (response) => {
        const data = await response.json();
        if (
          !response.ok ||
          typeof data.authenticated !== "boolean" ||
          typeof data.following !== "boolean" ||
          typeof data.notifyComments !== "boolean" ||
          typeof data.muted !== "boolean" ||
          data.targetType !== "content" ||
          data.targetId !== contentId
        )
          throw new Error("Invalid state");
        if (active) {
          setAuthenticated(data.authenticated);
          setFollowing(data.following);
          setNotifyComments(data.notifyComments);
          setMuted(data.muted);
          setMutedUntil(typeof data.mutedUntil === "string" ? data.mutedUntil : null);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [contentId, attempt, initial]);

  async function mutateFollow(desiredFollowing: boolean, desiredNotify: boolean) {
    if (!alive.current || busy.current || !ready || !authenticated) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    const controller = new AbortController();
    write.current = controller;
    try {
      const response = await fetch(
        "/api/follow",
        privateApiRequest({
          method: desiredFollowing ? "POST" : "DELETE",
          json: desiredFollowing
            ? { targetType: "content", targetId: contentId, notifyComments: desiredNotify }
            : { targetType: "content", targetId: contentId },
          signal: controller.signal,
          timeoutMs: 15_000,
        }),
      );
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (response.status === 401) {
        setAuthenticated(false);
        setReady(true);
        return;
      }
      if (
        !confirmsFollowMutation(
          response.status,
          data,
          "content",
          contentId,
          desiredFollowing,
          desiredFollowing ? desiredNotify : false,
        )
      ) {
        setMessage(followError(locale, response.ok ? "UNCONFIRMED" : data?.code));
        setFailed(true);
        return;
      }
      setFollowing(desiredFollowing);
      setNotifyComments(desiredFollowing ? desiredNotify : false);
      setMessage(copy.success);
    } catch {
      if (alive.current) {
        setFailed(true);
        setMessage(copy.unconfirmed);
      }
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  async function mutateMute(duration: ObjectMuteDuration | null) {
    if (!alive.current || busy.current || !ready || !authenticated) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    const controller = new AbortController();
    write.current = controller;
    try {
      const response = await fetch(
        "/api/object-mute",
        privateApiRequest({
          method: "POST",
          json: { targetType: "content", targetId: contentId, duration },
          signal: controller.signal,
          timeoutMs: 15_000,
        }),
      );
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (
        !response.ok ||
        data?.success !== true ||
        data?.targetType !== "content" ||
        data?.targetId !== contentId ||
        typeof data?.muted !== "boolean"
      ) {
        setMessage(followError(locale, data?.code));
        setFailed(true);
        return;
      }
      setMuted(data.muted);
      setMutedUntil(typeof data.mutedUntil === "string" ? data.mutedUntil : null);
      setMessage(copy.muteSuccess);
    } catch {
      if (alive.current) {
        setFailed(true);
        setMessage(copy.unconfirmed);
      }
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  const loading = pending || !ready;

  if (failed) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setMessage("");
            setAttempt((value) => value + 1);
          }}
        >
          {copy.retry}
        </Button>
        <p role="alert" className="text-xs text-danger">
          {message || copy.error}
        </p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="space-y-2" aria-busy={!ready && !failed}>
        <GuestAuthLinks
          loginHref={loginHref}
          registerHref={registerHref}
          signInLabel={copy.signIn}
          createAccountLabel={workspace.createAccount}
        />
        <p className="max-w-sm text-xs text-muted">{copy.discussionHelp}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-busy={loading}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className={`min-h-11 ${following ? "text-accent" : ""}`}
          disabled={pending || !ready}
          aria-pressed={ready ? following : undefined}
          aria-label={`${following ? copy.removeSave : copy.savePublication}: ${title}`}
          onClick={() => void mutateFollow(!following, following ? notifyComments : false)}
        >
          {pending || !ready ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : following ? (
            <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          )}
          {following ? copy.savedPublication : copy.savePublication}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={`min-h-11 ${notifyComments ? "text-accent" : ""}`}
          disabled={pending || !ready}
          aria-pressed={ready ? notifyComments : undefined}
          aria-label={`${notifyComments ? copy.stopWatchingDiscussion : copy.watchDiscussion}: ${title}`}
          onClick={() => void mutateFollow(true, !notifyComments)}
        >
          {pending || !ready ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : notifyComments ? (
            <Bell className="h-4 w-4" aria-hidden="true" />
          ) : (
            <BellOff className="h-4 w-4" aria-hidden="true" />
          )}
          {notifyComments ? copy.watchingDiscussion : copy.watchDiscussion}
        </Button>
      </div>
      <p className="max-w-md text-xs text-muted">
        {notifyComments ? copy.watchingHint : following ? copy.quietSaveHint : copy.discussionHelp}
      </p>
      <div className="space-y-2">
        <p className="text-xs text-muted">{copy.muteHelp}</p>
        {muted && mutedUntil && (
          <p role="status" className="text-xs text-secondary">
            {copy.mutedUntil}:{" "}
            {new Date(mutedUntil).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
          </p>
        )}
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
          {muted && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 text-xs"
              disabled={pending || !ready}
              onClick={() => void mutateMute(null)}
            >
              {copy.unmute}
            </Button>
          )}
        </div>
      </div>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`max-w-sm text-xs ${failed ? "text-danger" : "text-success"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
