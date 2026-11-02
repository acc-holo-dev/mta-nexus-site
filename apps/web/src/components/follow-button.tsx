"use client";
import { Button } from "@nexus/ui";
import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmsFollowMutation } from "../lib/follow-confirmation";
import type { FollowTargetType } from "../lib/follow-workspace-contract";
import { followActionCopy, followCopy, followError } from "../lib/follow-workspace-copy";
import { getDictionary, type Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
import { confirmAction } from "./confirm-action";
import { LocaleProvider, useNexusLocale } from "./locale-context";

type InitialFollowState = {
  authenticated: boolean;
  following: boolean;
  self?: boolean;
  error?: boolean;
};
export function FollowButton(props: {
  targetType: FollowTargetType;
  targetId: string;
  targetName: string;
  initial?: InitialFollowState;
  locale?: Locale;
}) {
  const control = <FollowControl key={`${props.targetType}:${props.targetId}`} {...props} />;
  return props.locale ? <LocaleProvider locale={props.locale}>{control}</LocaleProvider> : control;
}
function FollowControl({
  targetType,
  targetId,
  targetName,
  initial,
  locale: providedLocale,
}: {
  targetType: FollowTargetType;
  targetId: string;
  targetName: string;
  initial?: InitialFollowState;
  locale?: Locale;
}) {
  const { locale: appLocale } = useNexusLocale();
  const locale = providedLocale ?? appLocale;
  const shared = followCopy(locale);
  const copy = followActionCopy(locale, targetType);
  const workspace = getDictionary(locale).workspace;
  const pathname = usePathname();
  const authLinkFocus =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const [registerHref, setRegisterHref] = useState(() => authEntryHref("register", pathname));
  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh auth return paths after client navigation.
  useEffect(() => {
    const path = currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [pathname]);
  const [state, setState] = useState<
    "checking" | "anonymous" | "self" | "following" | "not-following" | "error"
  >(
    initial
      ? initial.error
        ? "error"
        : !initial.authenticated
          ? "anonymous"
          : initial.self
            ? "self"
            : initial.following
              ? "following"
              : "not-following"
      : "checking",
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const writeBlocked = useRef(state !== "following" && state !== "not-following");
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
    if (initial && attempt === 0) return;
    let active = true;
    const controller = new AbortController();
    writeBlocked.current = true;
    setState("checking");
    fetch(
      `/api/follow?${new URLSearchParams({ targetType, targetId })}`,
      privateApiRequest({ signal: controller.signal, timeoutMs: 15_000 }),
    )
      .then(async (response) => {
        const data = await response.json();
        if (
          !response.ok ||
          typeof data.authenticated !== "boolean" ||
          typeof data.following !== "boolean" ||
          data.targetType !== targetType ||
          data.targetId !== targetId
        )
          throw new Error("Invalid state");
        if (active) {
          writeBlocked.current = !data.authenticated || data.self === true;
          setState(
            !data.authenticated
              ? "anonymous"
              : data.self === true
                ? "self"
                : data.following
                  ? "following"
                  : "not-following",
          );
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [targetType, targetId, attempt, initial]);
  async function toggle() {
    if (
      !alive.current ||
      busy.current ||
      writeBlocked.current ||
      (state !== "following" && state !== "not-following")
    )
      return;
    const desired = state !== "following";
    if (
      !desired &&
      !(await confirmAction({
        title: shared.removeConfirmTitle,
        object: targetName,
        consequences: shared.removeConfirm,
        confirmLabel: copy.unfollow,
        cancelLabel: shared.cancel,
        closeLabel: shared.cancel,
      }))
    )
      return;
    busy.current = true;
    setPending(true);
    setMessage("");
    const controller = new AbortController();
    write.current = controller;
    try {
      const response = await fetch(
        "/api/follow",
        privateApiRequest({
          method: desired ? "POST" : "DELETE",
          json: { targetType, targetId },
          signal: controller.signal,
          timeoutMs: 15_000,
        }),
      );
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (response.status === 401) {
        writeBlocked.current = true;
        setState("anonymous");
        return;
      }
      if (!confirmsFollowMutation(response.status, data, targetType, targetId, desired)) {
        writeBlocked.current = true;
        setMessage(followError(locale, response.ok ? "UNCONFIRMED" : data?.code));
        setState("error");
        return;
      }
      setState(desired ? "following" : "not-following");
      setMessage(copy.success);
    } catch {
      if (alive.current) {
        writeBlocked.current = true;
        setState("error");
        setMessage(shared.unconfirmed);
      }
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  const linkStyle = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-base bg-surface px-4 py-2 text-sm font-semibold text-secondary ${authLinkFocus}`;
  const loading = pending || state === "checking";
  const showHint =
    state === "following" || state === "not-following" || state === "anonymous" || state === "self";
  return (
    <div className="space-y-2" aria-busy={loading}>
      {state === "anonymous" ? (
        <div className="flex flex-wrap items-center gap-4">
          <Link href={loginHref} className={linkStyle}>
            {copy.signIn}
          </Link>
          <Link
            href={registerHref}
            className={`inline-flex min-h-11 items-center text-sm text-secondary underline ${authLinkFocus}`}
          >
            {workspace.createAccount}
          </Link>
        </div>
      ) : state === "self" ? (
        <p className="text-sm text-muted">{copy.self}</p>
      ) : state === "error" ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setMessage("");
            setAttempt((value) => value + 1);
          }}
        >
          {shared.retry}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={`min-h-11 ${state === "following" ? "text-accent" : ""}`}
          disabled={pending || state === "checking"}
          onClick={toggle}
          aria-pressed={state === "checking" ? undefined : state === "following"}
          aria-label={`${state === "following" ? copy.unfollow : copy.follow}: ${targetName}`}
        >
          {pending || state === "checking" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : state === "following" ? (
            <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          )}
          {pending
            ? copy.saving
            : state === "checking"
              ? copy.checking
              : state === "following"
                ? copy.following
                : copy.follow}
        </Button>
      )}
      {showHint && <p className="max-w-sm text-xs text-muted">{copy.hint}</p>}
      {message && (
        <p
          role={state === "error" ? "alert" : "status"}
          className={`max-w-sm text-xs ${state === "error" ? "text-danger" : "text-success"}`}
        >
          {message}
        </p>
      )}
      {state === "error" && !message && (
        <p role="alert" className="text-xs text-danger">
          {shared.error}
        </p>
      )}
    </div>
  );
}
