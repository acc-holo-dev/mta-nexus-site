"use client";
import { type CommercialPlan, commercialFeeEstimate, type PlanReviewCommand } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { commercialPlanTermsSchema, planReviewCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { formatHistoryAmount } from "../lib/commerce-history-format";
import { commercialTerms, parseCommercialAmount } from "../lib/commercial-confirmation";
import { confirmedPlanReview, expectedPlanReviewId } from "../lib/plan-review-confirmation";
import { planReviewError, planReviewsCopy } from "../lib/plan-reviews-i18n";
import { planReviewHref } from "../lib/plan-reviews-query";
import { privateApiRequest } from "../lib/private-api-request";
import { useNexusLocale } from "./locale-context";
import { PlanReviewTerms } from "./plan-review-terms";
export function PlanReviewForm({
  plan,
  actorId,
  scopes,
}: {
  plan: Omit<CommercialPlan, "updatedAt">;
  actorId: string;
  scopes: { id: string; name: string }[];
}) {
  const { locale } = useNexusLocale(),
    c = planReviewsCopy(locale),
    router = useRouter(),
    field = useId(),
    lock = useRef(false),
    request = useRef<PlanReviewCommand | null>(null),
    termsRef = useRef<ReturnType<typeof commercialTerms> | null>(null),
    controller = useRef<AbortController | null>(null),
    epoch = useRef(0),
    localeRef = useRef(locale);
  localeRef.current = locale;
  const renderScope = `${actorId}:${plan.id}:${plan.scope}`;
  const priorScope = useRef(renderScope);
  if (priorScope.current !== renderScope) {
    priorScope.current = renderScope;
    epoch.current += 1;
  }
  const [amount, setAmount] = useState("100.00"),
    [currency, setCurrency] = useState<"USD" | "EUR" | "RUB">(plan.currency),
    [organizationId, setOrganization] = useState(scopes[0]?.id ?? "");
  const [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [error, setError] = useState("");
  const [readyScope, setReadyScope] = useState("");
  const [snapshot, setSnapshot] = useState<{
    terms: ReturnType<typeof commercialTerms>;
    revision: number;
  } | null>(null);
  const storageKey = `nexus:plan-review:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(plan.id)}`;
  useEffect(() => {
    let alive = true;
    epoch.current += 1;
    controller.current?.abort();
    request.current = null;
    termsRef.current = null;
    lock.current = false;
    setReadyScope("");
    setSnapshot(null);
    setFrozen(false);
    setBusy(false);
    setError("");
    setAmount("100.00");
    setCurrency(plan.currency);
    setOrganization(scopes[0]?.id ?? "");
    async function restore() {
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          if (raw.length > 20_000) throw new Error("storage");
          const item = JSON.parse(raw);
          const parsed = planReviewCommandSchema.safeParse(item?.command);
          const savedTerms = commercialPlanTermsSchema.safeParse(item?.terms);
          if (
            item?.actorId !== actorId ||
            !parsed.success ||
            !savedTerms.success ||
            parsed.data.planId !== plan.id ||
            (parsed.data.organizationId ? "organization" : "user") !== plan.scope ||
            item.subjectId !== (parsed.data.organizationId ?? actorId)
          )
            throw new Error("storage");
          if (alive) {
            request.current = parsed.data;
            termsRef.current = savedTerms.data;
            setSnapshot({ terms: savedTerms.data, revision: parsed.data.expectedRevision });
            setAmount((parsed.data.grossAmount / 100).toFixed(2));
            setCurrency(parsed.data.currency);
            setOrganization(parsed.data.organizationId ?? "");
            setFrozen(true);
          }
        }
        if (alive) setReadyScope(renderScope);
      } catch {
        if (alive)
          setError(
            localeRef.current === "ru"
              ? "Не удалось проверить сессию или восстановить выбор. Обновите страницу и войдите в исходный аккаунт."
              : "Could not verify the session or restore the selection. Refresh and sign in to the original account.",
          );
      }
    }
    void restore();
    return () => {
      alive = false;
      controller.current?.abort();
    };
  }, [actorId, plan.id, plan.scope, plan.currency, scopes[0]?.id, storageKey, renderScope]);
  const shownPlan = snapshot ? { ...plan, ...snapshot.terms, revision: snapshot.revision } : plan;
  const minor = parseCommercialAmount(amount),
    estimate =
      minor === null || minor > 100_000_000
        ? null
        : commercialFeeEstimate(minor, currency, shownPlan.commissionBps);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || readyScope !== renderScope) return;
    const operationEpoch = epoch.current;
    const firstAttempt = !request.current;
    const parsed = planReviewCommandSchema.safeParse(
      request.current ?? {
        requestId: crypto.randomUUID(),
        planId: plan.id,
        expectedRevision: plan.revision,
        grossAmount: minor,
        currency,
        ...(plan.scope === "organization" ? { organizationId } : {}),
      },
    );
    if (!parsed.success) {
      setError(c.invalid);
      return;
    }
    const terms = termsRef.current ?? commercialTerms(plan);
    if (firstAttempt) {
      try {
        const raw = JSON.stringify({
          actorId,
          subjectId: parsed.data.organizationId ?? actorId,
          command: parsed.data,
          terms,
        });
        sessionStorage.setItem(storageKey, raw);
        if (sessionStorage.getItem(storageKey) !== raw) throw new Error("storage");
      } catch {
        setError(
          locale === "ru"
            ? "Не удалось сохранить данные восстановления. Обзор не отправлен."
            : "Could not save recovery data. The review was not submitted.",
        );
        return;
      }
      request.current = parsed.data;
      termsRef.current = terms;
      setSnapshot({ terms, revision: parsed.data.expectedRevision });
    }
    const command = parsed.data;
    setFrozen(true);
    lock.current = true;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const expectedId = await expectedPlanReviewId(actorId, command.requestId);
      if (operationEpoch !== epoch.current || abort.signal.aborted) return;
      const response = await fetch("/api/subscriptions/reviews", {
        ...privateApiRequest({ method: "POST", json: command, signal: abort.signal }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      if (operationEpoch !== epoch.current || abort.signal.aborted) return;
      const id = response.ok
        ? confirmedPlanReview(body, command, actorId, terms, expectedId)
        : null;
      if (!id) {
        if (
          firstAttempt &&
          [400, 401, 403, 404, 409, 413, 415, 422, 428, 429].includes(response.status)
        ) {
          try {
            sessionStorage.removeItem(storageKey);
            if (sessionStorage.getItem(storageKey) !== null) throw new Error("storage");
            request.current = null;
            termsRef.current = null;
            setSnapshot(null);
            setFrozen(false);
          } catch {
            /* Preserve pending if storage cannot be cleared. */
          }
        }
        if (response.status === 401 || body?.code === "ACTOR_CHANGED") setReadyScope("");
        setError(planReviewError(locale, body?.code));
        return;
      }
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Exact replay remains safe. */
      }
      router.push(planReviewHref(id, command.organizationId));
      router.refresh();
    } catch {
      if (operationEpoch === epoch.current && !abort.signal.aborted) setError(c.retry);
    } finally {
      if (operationEpoch === epoch.current) {
        lock.current = false;
        if (!abort.signal.aborted) setBusy(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  }
  return (
    <>
      {readyScope !== renderScope && error ? <ErrorState title={error} /> : null}
      <form
        onSubmit={submit}
        hidden={readyScope !== renderScope}
        style={readyScope !== renderScope ? { display: "none" } : undefined}
        className="nexus-panel min-w-0 space-y-5 overflow-x-clip p-5"
      >
        <PlanReviewTerms terms={shownPlan} locale={locale} />
        <p className="text-sm">
          {c.revision} {shownPlan.revision} · {plan.scope === "user" ? c.personal : c.organization}
        </p>
        <p role="note" className="text-sm text-secondary">
          {c.notice}
        </p>
        <fieldset disabled={busy || frozen} className="grid gap-4 sm:grid-cols-2">
          {plan.scope === "organization" ? (
            <label htmlFor={`${field}-org`} className="space-y-2">
              <span>{c.organization}</span>
              <select
                id={`${field}-org`}
                required
                value={organizationId}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full rounded border border-base bg-surface p-2"
              >
                <option value="">—</option>
                {frozen &&
                organizationId &&
                !scopes.some((scope) => scope.id === organizationId) ? (
                  <option value={organizationId}>
                    {locale === "ru"
                      ? `Исходная организация: ${organizationId}`
                      : `Original organization: ${organizationId}`}
                  </option>
                ) : null}
                {scopes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label htmlFor={`${field}-amount`} className="space-y-2">
            <span>{c.amount}</span>
            <input
              id={`${field}-amount`}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              maxLength={14}
              className="w-full rounded border border-base bg-surface p-2"
            />
          </label>
          <label htmlFor={`${field}-currency`} className="space-y-2">
            <span>{c.currency}</span>
            <select
              id={`${field}-currency`}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
              className="w-full rounded border border-base bg-surface p-2"
            >
              {["USD", "EUR", "RUB"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        {estimate ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt>{c.fee}</dt>
              <dd>{formatHistoryAmount(estimate.platformFee, currency, locale)}</dd>
            </div>
            <div>
              <dt>{c.proceeds}</dt>
              <dd>{formatHistoryAmount(estimate.sellerProceeds, currency, locale)}</dd>
            </div>
          </dl>
        ) : null}
        <p className="text-sm text-muted">{c.baseline}</p>
        {frozen ? (
          <p role="note" className="text-sm text-muted">
            {c.frozen}
          </p>
        ) : null}
        {error ? (
          <ErrorState title={error} description={frozen ? c.retry : c.formErrorHint} />
        ) : null}
        <Button
          type="submit"
          disabled={busy || (plan.scope === "organization" && !organizationId)}
          isLoading={busy}
          className="min-h-11"
        >
          {busy ? c.saving : c.save}
        </Button>
      </form>
    </>
  );
}
