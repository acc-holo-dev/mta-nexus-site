"use client";
import {
  COMMERCIAL_CURRENCIES,
  COMMERCIAL_PLAN_DURATIONS,
  type CommercialPlan,
  type CommercialPlanCommand,
} from "@nexus/domain";
import { Button, ErrorState, fieldClassBlock } from "@nexus/ui";
import { commercialPlanCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { confirmedCommercialPlan, parseCommercialAmount } from "../lib/commercial-confirmation";
import { commercialError, getCommercialCopy } from "../lib/commercial-i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmAction } from "./confirm-action";
import { useNexusLocale } from "./locale-context";

export function CommercialPlanForm({
  plan,
  actorId,
}: {
  plan?: Omit<CommercialPlan, "updatedAt">;
  actorId: string;
}) {
  const { locale } = useNexusLocale(),
    copy = getCommercialCopy(locale),
    router = useRouter(),
    field = useId(),
    lock = useRef(false),
    epoch = useRef(0),
    controller = useRef<AbortController | null>(null);
  const identity = `${actorId}:${plan?.id ?? "new"}`;
  const currentIdentity = useRef(identity);
  if (currentIdentity.current !== identity) {
    currentIdentity.current = identity;
    epoch.current++;
  }
  const key = `nexus:commercial-plan-intent:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(plan?.id ?? "new")}`;
  const [ready, setReady] = useState("");
  const [marker, setMarker] = useState<{
    actorId: string;
    planId: string | null;
    action: string;
    slug: string;
  } | null>(null);
  const initial = {
    titleRu: plan?.titleRu ?? "",
    titleEn: plan?.titleEn ?? "",
    descriptionRu: plan?.descriptionRu ?? "",
    descriptionEn: plan?.descriptionEn ?? "",
    price: ((plan?.price ?? 0) / 100).toFixed(2),
    currency: plan?.currency ?? "USD",
    durationDays: String(plan?.durationDays ?? 30),
    commission: ((plan?.commissionBps ?? 1000) / 100).toFixed(2),
  };
  const [values, setValues] = useState(initial),
    [slug, setSlug] = useState(""),
    [scope, setScope] = useState<"user" | "organization">("user");
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const dirty = Object.keys(initial).some(
    (key) => values[key as keyof typeof values] !== initial[key as keyof typeof initial],
  );
  // The identity key is the restore boundary; other prop changes must not replace an operation in progress.
  // biome-ignore lint/correctness/useExhaustiveDependencies: identity identifies the actor and form.
  useEffect(() => {
    let active = true;
    epoch.current++;
    controller.current?.abort();
    lock.current = false;
    setReady("");
    setMarker(null);
    setError("");
    setBusy(false);
    setSaved(false);
    setValues(initial);
    setSlug("");
    setScope("user");
    setReason("");
    async function restore() {
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(key);
        if (raw) {
          if (raw.length > 2048) throw new Error("storage");
          const item = JSON.parse(raw);
          if (
            item?.actorId !== actorId ||
            item.planId !== (plan?.id ?? null) ||
            !["create", "save", "publish", "archive", "restore"].includes(item.action) ||
            typeof item.slug !== "string" ||
            item.slug.length > 80
          )
            throw new Error("storage");
          if (active) setMarker(item);
        }
        if (active) setReady(identity);
      } catch {
        if (active)
          setError(
            locale === "ru"
              ? "Не удалось проверить аккаунт или восстановить запрос. Обновите страницу и войдите в исходный аккаунт."
              : "Could not verify the account or restore the request. Refresh and sign in to the original account.",
          );
      }
    }
    void restore();
    return () => {
      active = false;
      epoch.current++;
      controller.current?.abort();
    };
  }, [identity, key]);
  const disabled = busy || saved || !!marker || ready !== identity;
  async function clearMarker() {
    if (!marker || lock.current || ready !== identity || currentIdentity.current !== identity)
      return;
    lock.current = true;
    const version = epoch.current;
    try {
      const accepted = await confirmAction({
        title:
          locale === "ru" ? "Результат операции неизвестен" : "The operation result is unknown",
        object: marker.slug,
        consequences:
          locale === "ru"
            ? "Сначала проверьте список и историю. Снятие блокировки не подтверждает результат и может привести к повторной операции."
            : "Check the list and history first. Clearing this warning does not confirm the result and may allow a duplicate operation.",
        confirmLabel: locale === "ru" ? "Я проверил результат" : "I checked the result",
        cancelLabel: locale === "ru" ? "Отмена" : "Cancel",
        closeLabel: locale === "ru" ? "Отмена" : "Cancel",
        danger: true,
      });
      if (!accepted || version !== epoch.current) return;
      const response = await fetch("/api/auth/session", privateApiRequest());
      const session = await response.json();
      if (version !== epoch.current) return;
      if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
        throw new Error("identity");
      sessionStorage.removeItem(key);
      if (sessionStorage.getItem(key) !== null) throw new Error("storage");
      setMarker(null);
      setError("");
    } catch {
      if (version === epoch.current)
        setError(
          locale === "ru"
            ? "Не удалось проверить аккаунт или снять блокировку."
            : "Could not verify the account or clear the warning.",
        );
    } finally {
      if (version === epoch.current) lock.current = false;
    }
  }
  async function send(action: CommercialPlanCommand["action"]) {
    if (lock.current || disabled || currentIdentity.current !== identity) return;
    const version = epoch.current;
    const terms = {
      titleRu: values.titleRu,
      titleEn: values.titleEn,
      descriptionRu: values.descriptionRu,
      descriptionEn: values.descriptionEn,
      price: parseCommercialAmount(values.price),
      currency: values.currency,
      durationDays: Number(values.durationDays),
      commissionBps: parseCommercialAmount(values.commission),
    };
    const parsed = commercialPlanCommandSchema.safeParse(
      action === "create"
        ? { action, slug, scope, terms, reason }
        : action === "save"
          ? { action, expectedRevision: plan?.revision, terms, reason }
          : { action, expectedRevision: plan?.revision, reason },
    );
    if (!parsed.success) {
      setError(copy.errors.COMMERCIAL_PLAN_INVALID);
      return;
    }
    if (action === "publish" || action === "archive" || action === "restore") {
      const accepted = await confirmAction({
        title: copy[action],
        object: plan?.slug ?? slug,
        consequences: copy[`${action}Confirm`],
        confirmLabel: copy[action],
        cancelLabel: locale === "ru" ? "Отмена" : "Cancel",
        closeLabel: locale === "ru" ? "Отмена" : "Cancel",
        ...(action === "archive" ? { danger: true } : { danger: false }),
      });
      if (!accepted || version !== epoch.current) return;
    }
    const intent = {
      actorId,
      planId: plan?.id ?? null,
      action: parsed.data.action,
      slug: parsed.data.action === "create" ? parsed.data.slug : (plan?.slug ?? ""),
    };
    try {
      if (sessionStorage.getItem(key) !== null) throw new Error("pending");
      const raw = JSON.stringify(intent);
      sessionStorage.setItem(key, raw);
      if (sessionStorage.getItem(key) !== raw) throw new Error("storage");
    } catch {
      setError(
        locale === "ru"
          ? "Не удалось сохранить состояние восстановления. Запрос не отправлен."
          : "Could not save recovery state. The request was not sent.",
      );
      return;
    }
    setMarker(intent);
    lock.current = true;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch(
        `/api/admin/commerce/plans${plan ? `/${encodeURIComponent(plan.id)}` : ""}`,
        {
          ...privateApiRequest({ method: "POST", json: parsed.data, signal: abort.signal }),
          headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
        },
      );
      const body = await response.json().catch(() => null);
      if (version !== epoch.current || abort.signal.aborted) return;
      const result =
        body?.actorId === actorId ? confirmedCommercialPlan(body, parsed.data, plan) : null;
      if (!response.ok || !result) {
        if ([400, 401, 403, 404, 409, 413, 415, 422, 428, 429].includes(response.status)) {
          try {
            sessionStorage.removeItem(key);
            if (sessionStorage.getItem(key) !== null) throw new Error("storage");
            setMarker(null);
          } catch {
            /* Keep the marker until explicitly reviewed. */
          }
        }
        if (response.status === 401 || body?.code === "ACTOR_CHANGED") setReady("");
        setError(commercialError(locale, body?.code));
        if (response.status === 409) router.refresh();
        return;
      }
      try {
        sessionStorage.removeItem(key);
        if (sessionStorage.getItem(key) === null) setMarker(null);
      } catch {
        /* A retained marker requires manual review. */
      }
      setSaved(true);
      if (!plan) router.push(`/admin/commerce/plans/${result.id}`);
      router.refresh();
    } catch {
      if (version === epoch.current && !abort.signal.aborted) setError(copy.errors.fallback);
    } finally {
      if (version === epoch.current) {
        lock.current = false;
        setBusy(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(plan ? "save" : "create");
  }
  const patch = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  if (ready !== identity)
    return (
      <section className="nexus-panel p-5">
        <p role="note">{copy.editNote}</p>
        {error ? <ErrorState title={error} description={copy.formErrorHint} /> : null}
      </section>
    );
  return (
    <form onSubmit={submit} className="nexus-panel min-w-0 space-y-5 overflow-x-clip p-5">
      <p role="note" className="text-sm text-secondary">
        {copy.editNote}
      </p>
      <fieldset
        disabled={disabled || plan?.status === "archived"}
        className="grid gap-4 sm:grid-cols-2"
      >
        {!plan ? (
          <>
            <label htmlFor={`${field}-slug`} className="space-y-2">
              <span className="text-sm">{copy.slug}</span>
              <input
                id={`${field}-slug`}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                maxLength={80}
                required
                className={fieldClassBlock}
              />
            </label>
            <label htmlFor={`${field}-scope`} className="space-y-2">
              <span className="text-sm">{copy.scope}</span>
              <select
                id={`${field}-scope`}
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value === "organization" ? "organization" : "user")
                }
                className={fieldClassBlock}
              >
                <option value="user">{copy.user}</option>
                <option value="organization">{copy.organization}</option>
              </select>
            </label>
          </>
        ) : null}
        {(["titleRu", "titleEn", "descriptionRu", "descriptionEn"] as const).map((key) => (
          <label key={key} htmlFor={`${field}-${key}`} className="space-y-2">
            <span className="text-sm">{copy[key]}</span>
            {key.startsWith("description") ? (
              <textarea
                id={`${field}-${key}`}
                value={values[key]}
                onChange={(event) => patch(key, event.target.value)}
                minLength={10}
                maxLength={2000}
                rows={5}
                required
                className={fieldClassBlock}
              />
            ) : (
              <input
                id={`${field}-${key}`}
                value={values[key]}
                onChange={(event) => patch(key, event.target.value)}
                minLength={3}
                maxLength={100}
                required
                className={fieldClassBlock}
              />
            )}
          </label>
        ))}
        <label htmlFor={`${field}-price`} className="space-y-2">
          <span className="text-sm">{copy.price}</span>
          <input
            id={`${field}-price`}
            inputMode="decimal"
            value={values.price}
            onChange={(event) => patch("price", event.target.value)}
            required
            className={fieldClassBlock}
          />
        </label>
        <label htmlFor={`${field}-currency`} className="space-y-2">
          <span className="text-sm">{copy.currency}</span>
          <select
            id={`${field}-currency`}
            value={values.currency}
            onChange={(event) => patch("currency", event.target.value)}
            className={fieldClassBlock}
          >
            {COMMERCIAL_CURRENCIES.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${field}-duration`} className="space-y-2">
          <span className="text-sm">{copy.duration}</span>
          <select
            id={`${field}-duration`}
            value={values.durationDays}
            onChange={(event) => patch("durationDays", event.target.value)}
            className={fieldClassBlock}
          >
            {COMMERCIAL_PLAN_DURATIONS.map((days) => (
              <option key={days} value={days}>
                {days} {copy.days}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${field}-commission`} className="space-y-2">
          <span className="text-sm">{copy.commission}</span>
          <input
            id={`${field}-commission`}
            inputMode="decimal"
            value={values.commission}
            onChange={(event) => patch("commission", event.target.value)}
            required
            className={fieldClassBlock}
          />
        </label>
      </fieldset>
      <label htmlFor={`${field}-reason`} className="block space-y-2">
        <span className="text-sm">{copy.reason}</span>
        <textarea
          id={`${field}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={5}
          maxLength={1000}
          rows={2}
          required
          disabled={disabled}
          className={fieldClassBlock}
        />
      </label>
      {plan && dirty ? (
        <p role="note" className="text-sm text-muted">
          {copy.dirtyNote}
        </p>
      ) : null}
      {marker ? (
        <ErrorState
          id="commercial-plan-operation-unknown"
          title={
            locale === "ru"
              ? "Результат предыдущей операции неизвестен. Проверьте список и историю перед снятием блокировки."
              : "The previous operation result is unknown. Check the list and history before clearing this warning."
          }
          description={marker.slug}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href="/admin/commerce/plans" className="underline">
                {copy.back}
              </a>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void clearMarker()}
              >
                {locale === "ru" ? "Я проверил результат" : "I checked the result"}
              </Button>
            </div>
          }
        />
      ) : null}
      {error ? <ErrorState title={error} description={copy.formErrorHint} /> : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={disabled || plan?.status === "archived" || (!!plan && !dirty)}
          isLoading={busy}
          className="min-h-11"
        >
          {busy ? copy.saving : plan ? copy.save : copy.create}
        </Button>
        {plan
          ? (plan.status === "archived"
              ? (["restore"] as const)
              : plan.status === "draft"
                ? (["publish", "archive"] as const)
                : (["archive"] as const)
            ).map((action) => (
              <Button
                key={action}
                type="button"
                variant="outline"
                onClick={() => void send(action)}
                disabled={disabled || dirty}
                className="min-h-11"
              >
                {copy[action]}
              </Button>
            ))
          : null}
      </div>
    </form>
  );
}
