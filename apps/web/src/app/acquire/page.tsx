"use client";

import { Suspense, useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Library,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@nexus/ui";
import { useNexusLocale } from "../../components/locale-context";

interface ProductInfo {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  licenseModel: string;
  currentVersion: string;
}

function AcquireContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.checkout;
  const summaryHeadingId = useId();
  const accessHeadingId = useId();
  const accessDescriptionId = useId();
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [claimedProductId, setClaimedProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies(loadRevision): Explicit refresh trigger; changing it must restart this request.
  useEffect(() => {
    if (!productId) return;

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    setProduct(null);
    setProductError(null);

    fetch(`/api/products/${encodeURIComponent(productId)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.id !== productId) {
          throw new Error(response.status === 404 ? copy.productNotFound : copy.loadFailed);
        }
        return data as ProductInfo;
      })
      .then((data) => {
        if (active) setProduct(data);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setProductError(
          caught instanceof Error && caught.message === copy.productNotFound
            ? copy.productNotFound
            : copy.loadFailed,
        );
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [productId, loadRevision, copy.productNotFound, copy.loadFailed]);

  async function handleClaim() {
    if (!product || loading) return;

    if (product.price > 0) {
      setError(copy.paidNotAvailable);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/resources/claim", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await response.json().catch(() => null);
      // The claim API answers 201 with { entitlement, alreadyClaimed } and does
      // not include a success flag; a claim is successful when an entitlement
      // object is present.
      if (!response.ok || !data?.entitlement) {
        throw new Error(data?.error || copy.claimFailed);
      }

      setClaimedProductId(product.id);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.unexpected,
      );
    } finally {
      setLoading(false);
    }
  }

  if (productId && claimedProductId === productId) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <section
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="nexus-panel space-y-5 p-8 text-center shadow-nexus"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-primary">
              {copy.resourceAdded}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {copy.resourceAddedMessage}
            </p>
          </div>

          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <Link
              href={`/market/${product?.slug ?? ""}`}
              className="rounded-lg bg-accent px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
            >
              {copy.openResource}
            </Link>
            <Link
              href="/workspace"
              className="rounded-lg border border-base bg-surface px-5 py-2.5 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
            >
              {copy.openLibrary}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!productId || productError) {
    return (
      <div
        role={productError ? "alert" : undefined}
        aria-live={productError ? "assertive" : undefined}
        className="mx-auto max-w-xl space-y-4 py-16 text-center"
      >
        <h1 className="font-display text-primary">
          {productId ? productError : copy.noProduct}
        </h1>
        {(!productId || productError === copy.productNotFound) && (
          <p className="text-sm text-muted">{copy.chooseResource}</p>
        )}
        <Link
          href="/market"
          className="inline-block rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
        >
          {copy.browse}
        </Link>
        {productId && productError && productError !== copy.productNotFound && (
          <button
            type="button"
            onClick={() => setLoadRevision((value) => value + 1)}
            className="ml-3 rounded-lg border border-base px-4 py-2 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nexus-accent)]"
          >
            {copy.retry}
          </button>
        )}
      </div>
    );
  }

  if (!product || product.id !== productId) {
    return (
      <div
        role="status"
        className="mx-auto max-w-2xl py-12 text-center text-sm text-muted"
      >
        {copy.loadingProduct}
      </div>
    );
  }

  const formattedPrice =
    product.price === 0
      ? copy.free
      : new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
          style: "currency",
          currency: product.currency || "USD",
        }).format(product.price / 100);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <header className="border-b border-base pb-5">
        <h1 className="flex items-center gap-2.5 font-display text-primary">
          <Library className="h-6 w-6 text-accent" aria-hidden="true" />
          <span>{copy.title}</span>
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
          {copy.description}
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <section
        aria-labelledby={summaryHeadingId}
        className="nexus-panel space-y-4 p-6 shadow-nexus-sm"
      >
        <h2
          id={summaryHeadingId}
          className="font-label uppercase text-muted"
        >
          {copy.orderSummary}
        </h2>
        <dl className="divide-y divide-[color:var(--nexus-border)] text-sm">
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-muted">{copy.resource}</dt>
            <dd className="text-right font-semibold text-primary">
              {product.title}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-muted">{copy.price}</dt>
            <dd className="font-numeric font-bold text-primary">
              {formattedPrice}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-muted">{copy.licenseModel}</dt>
            <dd className="text-right capitalize text-primary">
              {product.licenseModel.replace(/_/g, " ")}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-muted">{copy.version}</dt>
            <dd className="font-numeric text-primary">
              v{product.currentVersion}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3 font-bold">
            <dt className="text-primary">{copy.totalDue}</dt>
            <dd className="font-numeric text-success">
              {formattedPrice}
            </dd>
          </div>
        </dl>
      </section>

      <section
        role={product.price > 0 ? "status" : undefined}
        aria-live={product.price > 0 ? "polite" : undefined}
        aria-atomic={product.price > 0 ? "true" : undefined}
        aria-labelledby={accessHeadingId}
        aria-describedby={accessDescriptionId}
        className="nexus-panel space-y-2 p-6"
      >
        <h2
          id={accessHeadingId}
          className="text-sm font-bold text-primary"
        >
          {product.price === 0 ? copy.freeResource : copy.paidCheckout}
        </h2>
        <p
          id={accessDescriptionId}
          className="text-sm leading-relaxed text-muted"
        >
          {product.price === 0 ? copy.noPaymentRequired : copy.paidDisabled}
        </p>
      </section>

      <Button
        type="button"
        onClick={() => void handleClaim()}
        disabled={product.price > 0}
        aria-describedby={accessDescriptionId}
        isLoading={loading}
        className="w-full"
      >
        {loading
          ? copy.adding
          : product.price === 0
            ? copy.addToLibrary
            : copy.paidUnavailable}
      </Button>

      <div
        role="note"
        className="flex items-center justify-center gap-2 text-xs text-muted"
      >
        <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
        <span>{copy.noSimulatedPayments}</span>
      </div>
    </div>
  );
}

export default function AcquirePage() {
  const { dictionary } = useNexusLocale();

  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="mx-auto max-w-2xl py-12 text-center text-sm text-muted"
        >
          {dictionary.checkout.loadingSession}
        </div>
      }
    >
      <AcquireContent />
    </Suspense>
  );
}

