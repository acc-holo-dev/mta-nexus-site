"use client";
import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COMMERCIAL_CURRENCIES,
  COMMERCIAL_PLAN_DURATIONS,
  type CommercialPlan,
  type CommercialPlanCommand,
} from "@nexus/domain";
import { Button } from "@nexus/ui";
import { commercialPlanCommandSchema } from "@nexus/validation";
import { privateApiRequest } from "../lib/private-api-request";
import { commercialError, getCommercialCopy } from "../lib/commercial-i18n";
import { confirmedCommercialPlan, parseCommercialAmount } from "../lib/commercial-confirmation";
import { useNexusLocale } from "./locale-context";

export function CommercialPlanForm({ plan }: { plan?: Omit<CommercialPlan, "updatedAt"> }) {
  const { locale } = useNexusLocale(),
    copy = getCommercialCopy(locale),
    router = useRouter(),
    field = useId(),
    lock = useRef(false);
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
  const disabled = busy || saved;
  async function send(action: CommercialPlanCommand["action"]) {
    if (lock.current || disabled) return;
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
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/commerce/plans${plan ? `/${encodeURIComponent(plan.id)}` : ""}`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const body = await response.json().catch(() => null),
        result = confirmedCommercialPlan(body, parsed.data, plan);
      if (!response.ok || !result) {
        setError(commercialError(locale, body?.code));
        if (response.status === 409) router.refresh();
        return;
      }
      setSaved(true);
      if (!plan) router.push(`/admin/commerce/plans/${result.id}`);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(plan ? "save" : "create");
  }
  const patch = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  return (
    <form onSubmit={submit} className="nexus-panel space-y-5 p-5">
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
                className="nexus-input w-full"
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
                className="nexus-input w-full"
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
                className="nexus-input w-full"
              />
            ) : (
              <input
                id={`${field}-${key}`}
                value={values[key]}
                onChange={(event) => patch(key, event.target.value)}
                minLength={3}
                maxLength={100}
                required
                className="nexus-input w-full"
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
            className="nexus-input w-full"
          />
        </label>
        <label htmlFor={`${field}-currency`} className="space-y-2">
          <span className="text-sm">{copy.currency}</span>
          <select
            id={`${field}-currency`}
            value={values.currency}
            onChange={(event) => patch("currency", event.target.value)}
            className="nexus-input w-full"
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
            className="nexus-input w-full"
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
            className="nexus-input w-full"
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
          className="nexus-input w-full"
        />
      </label>
      {plan && dirty ? (
        <p role="note" className="text-sm text-muted">
          {copy.dirtyNote}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
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
              >
                {copy[action]}
              </Button>
            ))
          : null}
      </div>
    </form>
  );
}
