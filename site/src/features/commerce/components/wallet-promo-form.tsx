"use client";

import { Button, ErrorState, Input } from "@nexus/ui";
import { walletPromoCreateSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import { typeBlockSpace2, typeSmSecondary, typeSmSuccess } from "../../shell/type-shell";
import { parseCommercialAmount } from "../commercial-confirmation";
import { getWalletCopy, walletError } from "../wallet-i18n";

export function WalletPromoForm({ actorId }: { actorId: string }) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const field = useId();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [percent, setPercent] = useState("10");
  const [amount, setAmount] = useState("5.00");
  const currencies = ["USD", "EUR", "RUB"] as const;
  const [currency, setCurrency] = useState<(typeof currencies)[number]>("RUB");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const max = maxRedemptions.trim();
    const payload = {
      code: code.trim(),
      kind,
      ...(kind === "percent" ? { percent: Number(percent) } : {}),
      ...(kind === "fixed" ? { amount: parseCommercialAmount(amount) ?? -1, currency } : {}),
      ...(max ? { maxRedemptions: Number(max) } : {}),
    };
    const parsed = walletPromoCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setError(copy.errors.PROMO_INVALID);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/commerce/promo-codes", {
        ...privateApiRequest({ method: "POST", json: parsed.data }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const saved =
        response.ok &&
        body &&
        typeof body === "object" &&
        typeof (body as { code?: unknown }).code === "string"
          ? (body as { code: string }).code
          : null;
      if (!saved || saved !== parsed.data.code.trim().toUpperCase()) {
        const failure = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, failure));
        return;
      }
      setCreated(saved);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <p role="status" className={typeSmSuccess}>
        {copy.promoSuccess.replace("{code}", created)}
      </p>
    );
  }

  return (
    <form className={panelClipSpace4P5} onSubmit={onSubmit}>
      <p className={typeSmSecondary}>{copy.promoNote}</p>
      <div className={typeBlockSpace2}>
        <label className="text-sm text-secondary" htmlFor={`${field}-code`}>
          {copy.promoCode}
        </label>
        <Input
          id={`${field}-code`}
          value={code}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setCode(event.target.value)}
          required
        />
      </div>
      <div className={typeBlockSpace2}>
        <label className="text-sm text-secondary" htmlFor={`${field}-kind`}>
          {copy.promoKind}
        </label>
        <select
          id={`${field}-kind`}
          className="min-h-11 w-full rounded-lg border border-base bg-surface px-3 text-sm text-primary"
          value={kind}
          onChange={(event) => setKind(event.target.value === "fixed" ? "fixed" : "percent")}
        >
          {(["percent", "fixed"] as const).map((option) => (
            <option key={option} value={option}>
              {option === "percent" ? copy.promoKindPercent : copy.promoKindFixed}
            </option>
          ))}
        </select>
      </div>
      {kind === "percent" ? (
        <div className={typeBlockSpace2}>
          <label className="text-sm text-secondary" htmlFor={`${field}-percent`}>
            {copy.promoPercent}
          </label>
          <Input
            id={`${field}-percent`}
            inputMode="numeric"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            required
          />
        </div>
      ) : (
        <div className={typeBlockSpace2}>
          <label className="text-sm text-secondary" htmlFor={`${field}-amount`}>
            {copy.promoAmount}
          </label>
          <Input
            id={`${field}-amount`}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <label className="text-sm text-secondary" htmlFor={`${field}-currency`}>
            {copy.currency}
          </label>
          <select
            id={`${field}-currency`}
            className="min-h-11 w-full rounded-lg border border-base bg-surface px-3 text-sm text-primary"
            value={currency}
            onChange={(event) => {
              const next = currencies.find((item) => item === event.target.value);
              if (next) setCurrency(next);
            }}
          >
            {currencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={typeBlockSpace2}>
        <label className="text-sm text-secondary" htmlFor={`${field}-max`}>
          {copy.promoMax}
        </label>
        <Input
          id={`${field}-max`}
          inputMode="numeric"
          value={maxRedemptions}
          onChange={(event) => setMaxRedemptions(event.target.value)}
        />
        <p className="text-[11px] text-muted">{copy.promoMaxHint}</p>
      </div>
      {error ? <ErrorState title={copy.promoTitle} description={error} /> : null}
      <Button type="submit" disabled={busy} isLoading={busy} className="min-h-11">
        {busy ? copy.promoSubmitting : copy.promoSubmit}
      </Button>
    </form>
  );
}
