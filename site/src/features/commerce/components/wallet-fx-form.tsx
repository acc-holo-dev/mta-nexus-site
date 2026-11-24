"use client";

import { Button, Input } from "@nexus/ui";
import { walletFxRateSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import { typeBlockSpace2, typeSmSecondary, typeSmSuccess } from "../../shell/type-shell";
import { parseCommercialAmount } from "../commercial-confirmation";
import { getWalletCopy, walletError } from "../wallet-i18n";

export function WalletFxForm({ actorId }: { actorId: string }) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const field = useId();
  const router = useRouter();
  const currencies = ["USD", "EUR", "RUB"] as const;
  const [baseCurrency, setBaseCurrency] = useState<(typeof currencies)[number]>("USD");
  const [quoteCurrency, setQuoteCurrency] = useState<(typeof currencies)[number]>("RUB");
  const [baseAmount, setBaseAmount] = useState("1.00");
  const [quoteAmount, setQuoteAmount] = useState("90.00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSaved(false);
    const payload = {
      baseCurrency,
      quoteCurrency,
      baseAmount: parseCommercialAmount(baseAmount) ?? -1,
      quoteAmount: parseCommercialAmount(quoteAmount) ?? -1,
    };
    const parsed = walletFxRateSchema.safeParse(payload);
    if (!parsed.success) {
      setError(copy.errors.FX_INVALID);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/commerce/fx-rates", {
        ...privateApiRequest({ method: "POST", json: parsed.data }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const ok =
        response.ok &&
        body &&
        typeof body === "object" &&
        (body as { baseCurrency?: unknown }).baseCurrency === parsed.data.baseCurrency &&
        (body as { quoteCurrency?: unknown }).quoteCurrency === parsed.data.quoteCurrency;
      if (!ok) {
        const failure = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, failure));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={panelClipSpace4P5} data-fx-form={actorId} onSubmit={onSubmit}>
      <p className={typeSmSecondary}>{copy.fxAdminNote}</p>
      <label className={typeBlockSpace2} htmlFor={`${field}-base`}>
        {copy.fxBase}
        <select
          id={`${field}-base`}
          value={baseCurrency}
          onChange={(event) => setBaseCurrency(event.target.value as (typeof currencies)[number])}
        >
          {currencies.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className={typeBlockSpace2} htmlFor={`${field}-base-amount`}>
        {copy.fxBaseAmount}
        <Input
          id={`${field}-base-amount`}
          inputMode="decimal"
          value={baseAmount}
          onChange={(event) => setBaseAmount(event.target.value)}
        />
      </label>
      <label className={typeBlockSpace2} htmlFor={`${field}-quote`}>
        {copy.fxQuote}
        <select
          id={`${field}-quote`}
          value={quoteCurrency}
          onChange={(event) => setQuoteCurrency(event.target.value as (typeof currencies)[number])}
        >
          {currencies.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className={typeBlockSpace2} htmlFor={`${field}-quote-amount`}>
        {copy.fxQuoteAmount}
        <Input
          id={`${field}-quote-amount`}
          inputMode="decimal"
          value={quoteAmount}
          onChange={(event) => setQuoteAmount(event.target.value)}
        />
      </label>
      {error ? (
        <p role="alert" className={typeSmSecondary}>
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className={typeSmSuccess}>
          {copy.fxSuccess}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? copy.fxSubmitting : copy.fxSubmit}
      </Button>
    </form>
  );
}
