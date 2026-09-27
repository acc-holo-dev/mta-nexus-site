"use client";

import { Suspense, useEffect, useState } from "react";
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
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;

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
        if (!response.ok || !data || typeof data.id !== "string") {
          throw new Error(copy.productNotFound);
        }
        return data as ProductInfo;
      })
      .then(setProduct)
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setProductError(
          caught instanceof Error && caught.message
            ? caught.message
            : copy.productNotFound,
        );
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [productId, copy.productNotFound]);

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
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || copy.claimFailed);
      }

      setCompleted(true);
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

  if (completed) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <section className="nexus-panel space-y-5 p-8 text-center shadow-nexus">
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
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">
          {productError || copy.noProduct}
        </h1>
        <p className="text-sm text-muted">{copy.chooseResource}</p>
        <Link
          href="/market"
          className="inline-block rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
        >
          {copy.browse}
        </Link>
      </div>
    );
  }

  if (!product) {
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

      <section className="nexus-panel space-y-4 p-6 shadow-nexus-sm">
        <h2 className="font-label uppercase text-muted">
          {copy.orderSummary}
        </h2>
        <div className="flex items-center justify-between gap-4 border-b border-base py-2 text-sm">
          <span className="font-semibold text-primary">{product.title}</span>
          <span className="font-numeric font-bold text-primary">
            {formattedPrice}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs text-muted">
          <span>
            {copy.licenseModel}:{" "}
            <span className="capitalize">
              {product.licenseModel.replace(/_/g, " ")}
            </span>
          </span>
          <span className="font-numeric">v{product.currentVersion}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-base pt-3 font-bold text-primary">
          <span>{copy.totalDue}</span>
          <span className="font-numeric text-success">
            {formattedPrice}
          </span>
        </div>
      </section>

      <section className="nexus-panel space-y-2 p-6">
        <h2 className="text-sm font-bold text-primary">
          {product.price === 0 ? copy.freeResource : copy.paidCheckout}
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          {product.price === 0 ? copy.noPaymentRequired : copy.paidDisabled}
        </p>
      </section>

      <Button
        type="button"
        onClick={() => void handleClaim()}
        disabled={product.price > 0}
        isLoading={loading}
        className="w-full"
      >
        {loading
          ? copy.adding
          : product.price === 0
            ? copy.addToLibrary
            : copy.paidUnavailable}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs text-muted">
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
