"use client";

import { Button, ErrorState } from "@nexus/ui";
import { KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDictionary } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import {
  confirmsServerClaimVerification,
  type IssuedServerClaimChallenge,
  parseIssuedServerClaimChallenge,
} from "../lib/server-claim-confirmation";
import { serverClaimErrorMessage } from "../lib/server-claim-status-view";
import { authEntryHref } from "./auth-return-path";
import { GuestAuthLinks } from "./guest-auth-links";
import { useNexusLocale } from "./locale-context";

function claimMarkerKey(serverId: string, actor: string) {
  return `nexus:server-claim:v1:${encodeURIComponent(actor)}:${encodeURIComponent(serverId)}`;
}

export function ServerClaimControlPanel({
  serverId,
  serverName,
  expectedActorId,
  refreshOnSuccess = false,
}: {
  serverId: string;
  serverName: string;
  expectedActorId: string | null;
  refreshOnSuccess?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, dictionary } = useNexusLocale();
  const workspace = getDictionary(locale).workspace;
  const copy = dictionary.serverClaim;
  const [challenge, setChallenge] = useState<IssuedServerClaimChallenge | null>(null);
  const [state, setState] = useState<
    "idle" | "issuing" | "issued" | "verifying" | "verified" | "unknown_issue" | "unknown_verify"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [actorId, setActorId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [identityVisible, setIdentityVisible] = useState(true);
  const identityEpoch = useRef(0);
  const lock = useRef(false);
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const scope = `${serverId}:${expectedActorId ?? "public"}`;
  const [readyScope, setReadyScope] = useState("");
  function mark(actor: string, phase: "issue" | "issued" | "verify") {
    try {
      const key = claimMarkerKey(serverId, actor);
      sessionStorage.setItem(key, phase);
      return sessionStorage.getItem(key) === phase;
    } catch {
      return false;
    }
  }
  function clearMark(actor: string) {
    try {
      const key = claimMarkerKey(serverId, actor);
      sessionStorage.removeItem(key);
      return sessionStorage.getItem(key) === null;
    } catch {
      return false;
    }
  }
  useEffect(() => {
    let alive = true;
    setReady(false);
    setActorId(null);
    setChallenge(null);
    setState("idle");
    setError(null);
    setRequiresLogin(false);
    async function bootstrap() {
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const data = await response.json();
        if (!response.ok) throw new Error("session");
        if (data?.authenticated === false) {
          if (expectedActorId !== null) throw new Error("identity changed");
          if (alive) {
            setRequiresLogin(true);
            setReadyScope(scope);
            setReady(true);
          }
          return;
        }
        if (
          data?.authenticated !== true ||
          typeof data?.user?.id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,128}$/u.test(data.user.id) ||
          expectedActorId !== data.user.id
        )
          throw new Error("session");
        const marker = sessionStorage.getItem(claimMarkerKey(serverId, data.user.id));
        if (alive) {
          setActorId(data.user.id);
          if (marker !== null) setState(marker === "verify" ? "unknown_verify" : "unknown_issue");
          setReadyScope(scope);
          setReady(true);
        }
      } catch {
        if (alive) {
          setError(
            localeRef.current === "ru"
              ? "Не удалось проверить сессию или хранилище. Обновите страницу."
              : "Could not check the session or storage. Refresh this page.",
          );
          setReadyScope(scope);
          setReady(true);
        }
      }
    }
    void bootstrap();
    return () => {
      alive = false;
    };
  }, [serverId, expectedActorId, scope]);

  useEffect(() => {
    if (!actorId || typeof window === "undefined" || typeof document === "undefined") return;
    let alive = true;
    function conceal() {
      identityEpoch.current += 1;
      setIdentityVisible(false);
    }
    async function recheck() {
      if (document.visibilityState === "hidden") return;
      const epoch = ++identityEpoch.current;
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const data = await response.json();
        if (!alive || epoch !== identityEpoch.current) return;
        if (!response.ok || data?.authenticated !== true || data?.user?.id !== actorId)
          throw new Error("identity");
        setIdentityVisible(true);
      } catch {
        if (!alive || epoch !== identityEpoch.current) return;
        setChallenge(null);
        setActorId(null);
        setState((current) =>
          current === "verifying" || current === "unknown_verify"
            ? "unknown_verify"
            : "unknown_issue",
        );
        setError(
          localeRef.current === "ru"
            ? "Сессия изменилась или не подтверждена. Обновите страницу."
            : "The session changed or could not be verified. Refresh this page.",
        );
      }
    }
    function visibilityChanged() {
      if (document.visibilityState === "hidden") conceal();
      else void recheck();
    }
    window.addEventListener("blur", conceal);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      alive = false;
      identityEpoch.current += 1;
      window.removeEventListener("blur", conceal);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [actorId]);

  async function issue() {
    if (
      !ready ||
      readyScope !== scope ||
      !identityVisible ||
      !actorId ||
      lock.current ||
      state !== "idle"
    )
      return;
    if (!mark(actorId, "issue")) {
      setError(
        locale === "ru"
          ? "Не удалось сохранить отметку операции. Запрос не отправлен."
          : "Could not save the operation marker. The request was not sent.",
      );
      return;
    }
    const requestEpoch = identityEpoch.current;
    lock.current = true;
    setState("issuing");
    setError(null);
    setRequiresLogin(false);
    try {
      const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}/claim-challenge`, {
        ...privateApiRequest({ method: "POST", timeoutMs: 10_000 }),
        headers: { "x-nexus-actor-id": actorId },
      });
      const data = await response.json().catch(() => null);
      if (requestEpoch !== identityEpoch.current) {
        setChallenge(null);
        setState("unknown_issue");
        return;
      }
      if (response.status >= 400 && response.status < 500) {
        if (!clearMark(actorId)) {
          setState("unknown_issue");
          return;
        }
        if (response.status === 401) setRequiresLogin(true);
        if (data?.code === "ACTOR_CHANGED") setActorId(null);
        setError(serverClaimErrorMessage(data, locale, copy.createError));
        setState("idle");
        return;
      }
      const issued = parseIssuedServerClaimChallenge(response.status, data, serverId);
      if (!issued || !mark(actorId, "issued")) {
        setState("unknown_issue");
        return;
      }
      setChallenge(issued);
      setState("issued");
    } catch {
      setState("unknown_issue");
    } finally {
      lock.current = false;
    }
  }

  async function verify() {
    if (
      !ready ||
      readyScope !== scope ||
      !actorId ||
      !identityVisible ||
      !challenge ||
      state !== "issued" ||
      lock.current
    )
      return;
    if (!mark(actorId, "verify")) {
      setError(
        locale === "ru"
          ? "Не удалось сохранить отметку операции. Запрос не отправлен."
          : "Could not save the operation marker. The request was not sent.",
      );
      return;
    }
    const requestEpoch = identityEpoch.current;
    lock.current = true;
    setState("verifying");
    setError(null);
    try {
      const response = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/claim-challenge/verify`,
        {
          ...privateApiRequest({
            method: "POST",
            json: { challengeId: challenge.challengeId, token: challenge.token },
            timeoutMs: 15_000,
          }),
          headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
        },
      );
      const data = await response.json().catch(() => null);
      if (requestEpoch !== identityEpoch.current) {
        setChallenge(null);
        setState("unknown_verify");
        return;
      }
      if (response.status >= 400 && response.status < 500) {
        if (!mark(actorId, "issued")) {
          setChallenge(null);
          setState("unknown_verify");
          return;
        }
        if (response.status === 401 || data?.code === "ACTOR_CHANGED") {
          setChallenge(null);
          setActorId(null);
          if (response.status === 401) setRequiresLogin(true);
          setError(serverClaimErrorMessage(data, locale, copy.proofRejected));
          setState("unknown_issue");
          return;
        }
        setError(serverClaimErrorMessage(data, locale, copy.proofRejected));
        setState("issued");
        return;
      }
      if (!confirmsServerClaimVerification(response.status, data, challenge.challengeId)) {
        setChallenge(null);
        setState("unknown_verify");
        return;
      }
      clearMark(actorId);
      setChallenge(null);
      setState("verified");
      if (refreshOnSuccess) router.refresh();
    } catch {
      setChallenge(null);
      setState("unknown_verify");
    } finally {
      lock.current = false;
    }
  }

  if (state === "verified") {
    return (
      <section className="nexus-panel space-y-2 border-[color:var(--nexus-success)]/20 p-5">
        <div className="flex items-center gap-2 text-success">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <h2 className="text-sm font-bold">{copy.verifiedTitle}</h2>
        </div>
        <p className="text-xs leading-relaxed text-muted">{copy.verifiedDescription}</p>
        <p className="text-[10px] text-faint">{copy.moderationSeparate}</p>
      </section>
    );
  }

  return (
    <section className="nexus-panel space-y-4 p-5" aria-labelledby="server-control-proof-heading">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <h2 id="server-control-proof-heading" className="text-sm font-bold text-primary">
            {copy.title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{copy.description}</p>
        </div>
      </div>

      {state === "unknown_issue" || state === "unknown_verify" ? (
        <ErrorState
          title={
            state === "unknown_issue"
              ? locale === "ru"
                ? "Результат создания проверки неизвестен. Токен восстановить нельзя; повтор заблокирован. Проверьте статус и обратитесь в поддержку."
                : "The challenge result is unknown. The token cannot be recovered; retry is blocked. Check the status and contact support."
              : locale === "ru"
                ? "Результат подтверждения неизвестен. Повтор заблокирован; проверьте заявки и обратитесь в поддержку."
                : "The verification result is unknown. Retry is blocked; check your requests and contact support."
          }
          action={
            <Link
              href="/workspace/verification"
              className="inline-flex min-h-11 items-center text-accent underline"
            >
              {locale === "ru" ? "Проверить заявки" : "Check requests"}
            </Link>
          }
        />
      ) : !identityVisible ? (
        <p role="status">
          {locale === "ru"
            ? "Проверяем сессию перед показом токена…"
            : "Checking the session before showing the token…"}
        </p>
      ) : !challenge ? (
        <Button
          type="button"
          variant="secondary"
          size="touch"
          isLoading={state === "issuing"}
          disabled={
            !ready || readyScope !== scope || !identityVisible || !actorId || state !== "idle"
          }
          onClick={() => void issue()}
        >
          {state === "issuing" ? copy.creating : copy.create}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-[color:var(--nexus-accent)]/20 bg-accent-soft p-3">
            <div className="font-label uppercase text-muted">{copy.tokenLabel}</div>
            <code className="mt-2 block select-all break-all font-mono text-sm font-bold text-accent">
              {challenge.token}
            </code>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted">
            <li>
              {copy.stepAddToken} <strong>{serverName}</strong>
            </li>
            <li>{copy.stepKeepVisible}</li>
            <li>{copy.stepVerify}</li>
          </ol>

          <p className="text-[10px] text-faint">
            {copy.expires}{" "}
            {new Date(challenge.expiresAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}.{" "}
            {copy.tokenEphemeral}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="touch"
              isLoading={state === "verifying"}
              disabled={
                !ready || readyScope !== scope || !identityVisible || !actorId || state !== "issued"
              }
              onClick={() => void verify()}
            >
              {state === "verifying" ? copy.checking : copy.verify}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              disabled={state === "verifying"}
              onClick={() => {
                if (!actorId || !clearMark(actorId)) {
                  setState("unknown_issue");
                  return;
                }
                setChallenge(null);
                setState("idle");
                setError(null);
              }}
            >
              {copy.startOver}
            </Button>
          </div>
        </div>
      )}

      {requiresLogin && (
        <div className="space-y-2 text-xs text-secondary">
          <GuestAuthLinks
            loginHref={authEntryHref("login", pathname)}
            registerHref={authEntryHref("register", pathname)}
            signInLabel={copy.signIn}
            createAccountLabel={workspace.createAccount}
          />
          <p>{copy.signInHint}</p>
        </div>
      )}

      {error ? <ErrorState title={error} /> : null}

      <p className="text-[10px] leading-relaxed text-faint">{copy.exactEndpoint}</p>
    </section>
  );
}
