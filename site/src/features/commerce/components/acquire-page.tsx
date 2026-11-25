"use client";

import type { ExplicitFxRate } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { CheckCircle2, Library, PackageOpen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useState } from "react";
import { getResourceActivityCopy } from "../../resources/resource-activity-i18n";
import { resourceClaimApiCopy } from "../../resources/resource-claim-api-copy";
import { confirmedResourceClaim } from "../../resources/resource-commerce-confirmation";
import { authEntryHref } from "../../shell/auth-return";
import { GuestAuthLinks } from "../../shell/guest-auth";
import { HonestLoadingShell } from "../../shell/honest-loading";
import { linkGhostAccentSm } from "../../shell/link-shell";
import { useNexusLocale } from "../../shell/locale";
import {
  pageShellMax2xlDensePy12,
  pageShellMax2xlStandard,
  pageShellMaxXl,
  pageShellMaxXlPy12,
} from "../../shell/page-shell";
import { skelH12W48, skelH28, skelPulseSpace4 } from "../../shell/skeleton-shell";
import {
  typeDisplayPrimary,
  typeFlexCenterBetweenGap4Py2,
  typeFlexMinCenterGap25Display,
  typeFlexWrapCenterJustifyGap3,
  typeIcon4Success,
  typeIcon6Accent,
  typeLabelUpperMuted,
  typeMinBreakWords,
  typeMt2SmMuted,
  typeNumericPrimary,
  typeSmBoldPrimary,
  typeSmLeadingMuted,
} from "../../shell/type-shell";
import { formatHistoryAmount } from "../commerce-history-format";
import { licenseModelLabel } from "../license-model-i18n";
import { WalletCheckoutButton } from "../wallet-checkout";
import { getWalletCopy } from "../wallet-i18n";
import { RecordedRateEstimate } from "./recorded-rate-estimate";

interface ProductInfo {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  licenseModel: string;
  currentVersion: string;
}

export type AcquirePageProps = {
  walletEnabled?: boolean;
  actorId?: string | null;
  signedIn?: boolean;
  fxRates?: readonly ExplicitFxRate[] | null;
};

const shellClass = pageShellMax2xlStandard;
const narrowShellClass = pageShellMaxXl;
const primaryLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const secondaryLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-base bg-surface px-5 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function AcquireContent({
  walletEnabled = false,
  actorId = null,
  signedIn = false,
  fxRates,
}: AcquirePageProps) {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");
  const rawBuildId = searchParams.get("buildId");
  const buildId = rawBuildId && /^[A-Za-z0-9_-]{1,128}$/u.test(rawBuildId) ? rawBuildId : null;
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.checkout;
  const walletCopy = getWalletCopy(locale);
  const authCopy = dictionary.auth;
  const claimCopy = resourceClaimApiCopy(locale);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [
      ...Object.values(copy),
      ...Object.values(claimCopy),
      ...Object.values(dictionary.product.downloadErrors),
    ].includes(text)
      ? text
      : fallback;
  }
  const activityCopy = getResourceActivityCopy(locale);
  const summaryHeadingId = useId();
  const accessHeadingId = useId();
  const accessDescriptionId = useId();
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [claimedProductId, setClaimedProductId] = useState<string | null>(null);
  const [claimedAccess, setClaimedAccess] =
    useState<ReturnType<typeof confirmedResourceClaim>>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const acquireReturnPath = productId
    ? `/acquire?productId=${encodeURIComponent(productId)}${
        buildId ? `&buildId=${encodeURIComponent(buildId)}` : ""
      }`
    : null;

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
    setNeedsSignIn(false);
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
      if (response.status === 401) {
        setNeedsSignIn(true);
        setError(dictionary.product.downloadErrors.signIn);
        return;
      }
      const confirmed = confirmedResourceClaim(data, product.id);
      if (!response.ok || !confirmed) {
        throw new Error(
          data?.code === "RATE_LIMIT_EXCEEDED" || data?.code === "RATE_LIMITED"
            ? claimCopy.rate
            : data?.code === "FORBIDDEN"
              ? claimCopy.forbidden
              : data?.code === "NOT_FOUND"
                ? claimCopy.notFound
                : data?.code === "VALIDATION_ERROR"
                  ? claimCopy.invalidClaim
                  : claimCopy.claimFailed || copy.claimFailed,
        );
      }

      setClaimedAccess(confirmed);
      setClaimedProductId(product.id);
    } catch (caught: unknown) {
      setError(safeMessage(caught, copy.unexpected));
    } finally {
      setLoading(false);
    }
  }

  if (productId && claimedProductId === productId) {
    return (
      <div className={pageShellMaxXlPy12}>
        <section
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="nexus-panel min-w-0 space-y-5 overflow-x-clip p-8 text-center shadow-nexus"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
          </div>
          <div>
            <h1 className={typeDisplayPrimary}>
              {claimedAccess?.kind === "license" ? activityCopy.licenseTitle : copy.resourceAdded}
            </h1>
            <p className={typeMt2SmMuted}>
              {claimedAccess?.kind === "license"
                ? activityCopy.licenseNote
                : copy.resourceAddedMessage}
            </p>
            {claimedAccess?.kind === "license" ? (
              <p className="mt-3 text-sm text-secondary">
                {claimedAccess.expiresAt ? (
                  <>
                    {activityCopy.expires}{" "}
                    <time dateTime={claimedAccess.expiresAt}>
                      {new Date(claimedAccess.expiresAt).toLocaleString(
                        locale === "ru" ? "ru-RU" : "en-US",
                      )}
                    </time>
                  </>
                ) : (
                  activityCopy.perpetual
                )}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <Link href={`/market/${product?.slug ?? ""}`} className={primaryLinkClass}>
              {copy.openResource}
            </Link>
            <Link href="/workspace/library" className={secondaryLinkClass}>
              {copy.openLibrary}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!productId) {
    return (
      <div className={narrowShellClass}>
        <EmptyState
          title={copy.noProduct}
          description={copy.chooseResource}
          icon={<PackageOpen className="h-6 w-6" aria-hidden="true" />}
          action={
            <Link href="/market" className={primaryLinkClass}>
              {copy.browse}
            </Link>
          }
        />
      </div>
    );
  }

  if (productError) {
    const notFound = productError === copy.productNotFound;
    return (
      <div className={narrowShellClass}>
        {notFound ? (
          <EmptyState
            title={productError}
            description={copy.chooseResource}
            icon={<PackageOpen className="h-6 w-6" aria-hidden="true" />}
            action={
              <Link href="/market" className={primaryLinkClass}>
                {copy.browse}
              </Link>
            }
          />
        ) : (
          <ErrorState
            title={productError}
            description={dictionary.errors.message}
            action={
              <div className={typeFlexWrapCenterJustifyGap3}>
                <Button
                  type="button"
                  variant="ghost"
                  className={linkGhostAccentSm}
                  onClick={() => setLoadRevision((value) => value + 1)}
                >
                  {dictionary.errors.retry}
                </Button>
                <Link href="/market" className={linkGhostAccentSm}>
                  {copy.browse}
                </Link>
              </div>
            }
          />
        )}
      </div>
    );
  }

  if (!product || product.id !== productId) {
    return (
      <HonestLoadingShell
        className={pageShellMax2xlDensePy12}
        headingId="acquire-product-loading-heading"
        title={copy.title}
        loadingLabel={copy.loadingProduct}
        titleClassName="font-display text-primary"
        statusClassName="text-sm text-muted"
      >
        <div className={skelPulseSpace4} aria-hidden="true">
          <div className={skelH28} />
          <div className={skelH12W48} />
        </div>
      </HonestLoadingShell>
    );
  }

  const walletPurchase = walletEnabled && product.price > 0;
  const formattedPrice =
    product.price === 0
      ? copy.free
      : formatHistoryAmount(product.price, product.currency || "USD", locale);

  return (
    <div className={shellClass}>
      <header className="min-w-0 border-b border-base pb-5">
        <h1 className={typeFlexMinCenterGap25Display}>
          <Library className={typeIcon6Accent} aria-hidden="true" />
          <span className={typeMinBreakWords}>
            {walletPurchase ? walletCopy.checkoutTitle : copy.title}
          </span>
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
          {walletPurchase ? walletCopy.checkoutNote : copy.description}
        </p>
      </header>

      {error ? (
        <ErrorState
          title={error}
          description={copy.claimErrorHint}
          action={
            needsSignIn && acquireReturnPath ? (
              <GuestAuthLinks
                loginHref={authEntryHref("login", acquireReturnPath)}
                registerHref={authEntryHref("register", acquireReturnPath)}
                signInLabel={authCopy.signIn}
                createAccountLabel={authCopy.create}
                className="justify-center"
              />
            ) : undefined
          }
        />
      ) : null}

      <section
        aria-labelledby={summaryHeadingId}
        className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-6 shadow-nexus-sm"
      >
        <h2 id={summaryHeadingId} className={typeLabelUpperMuted}>
          {copy.orderSummary}
        </h2>
        <dl className="divide-y divide-[color:var(--nexus-border)] text-sm">
          <div className={typeFlexCenterBetweenGap4Py2}>
            <dt className="text-muted">{copy.resource}</dt>
            <dd className="min-w-0 break-words text-right font-semibold text-primary">
              {product.title}
            </dd>
          </div>
          <div className={typeFlexCenterBetweenGap4Py2}>
            <dt className="text-muted">{copy.price}</dt>
            <dd className="text-right font-numeric font-bold text-primary">
              {formattedPrice}
              {product.price > 0 ? (
                <RecordedRateEstimate
                  amount={product.price}
                  currency={product.currency || "USD"}
                  locale={locale === "ru" ? "ru" : "en"}
                  rates={fxRates}
                />
              ) : null}
            </dd>
          </div>
          <div className={typeFlexCenterBetweenGap4Py2}>
            <dt className="text-muted">{copy.licenseModel}</dt>
            <dd className="min-w-0 break-words text-right text-primary">
              {licenseModelLabel(locale, product.licenseModel)}
            </dd>
          </div>
          <div className={typeFlexCenterBetweenGap4Py2}>
            <dt className="text-muted">{copy.version}</dt>
            <dd className={typeNumericPrimary}>{`v${product.currentVersion}`}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3 font-bold">
            <dt className="text-primary">{copy.totalDue}</dt>
            <dd className="font-numeric text-success">{formattedPrice}</dd>
          </div>
        </dl>
      </section>

      {walletPurchase ? (
        <div className="space-y-3" data-acquire-intent="wallet">
          <WalletCheckoutButton
            actorId={actorId}
            productId={product.id}
            buildId={buildId ?? undefined}
            amountLabel={formattedPrice}
            amountMinor={product.price}
            currency={product.currency || "USD"}
            fxRates={fxRates}
            signedIn={signedIn}
            signInHref={authEntryHref("login", acquireReturnPath ?? "/acquire")}
          />
        </div>
      ) : (
        <>
          <section
            role={product.price > 0 ? "status" : undefined}
            aria-live={product.price > 0 ? "polite" : undefined}
            aria-atomic={product.price > 0 ? "true" : undefined}
            aria-labelledby={accessHeadingId}
            aria-describedby={accessDescriptionId}
            className="nexus-panel min-w-0 space-y-2 overflow-x-clip p-6"
          >
            <h2 id={accessHeadingId} className={typeSmBoldPrimary}>
              {product.price === 0 ? copy.freeResource : copy.paidCheckout}
            </h2>
            <p id={accessDescriptionId} className={typeSmLeadingMuted}>
              {product.price === 0 ? copy.noPaymentRequired : copy.paidDisabled}
            </p>
          </section>

          <Button
            type="button"
            size="touch"
            onClick={() => void handleClaim()}
            disabled={product.price > 0}
            aria-describedby={accessDescriptionId}
            isLoading={loading}
            className="w-full"
          >
            {loading ? copy.adding : product.price === 0 ? copy.addToLibrary : copy.paidUnavailable}
          </Button>

          <div role="note" className="flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className={typeIcon4Success} aria-hidden="true" />
            <span>{copy.noSimulatedPayments}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function AcquirePage(props: AcquirePageProps = {}) {
  const { dictionary } = useNexusLocale();

  return (
    <Suspense
      fallback={
        <HonestLoadingShell
          className={pageShellMax2xlDensePy12}
          headingId="acquire-session-loading-heading"
          title={dictionary.checkout.title}
          loadingLabel={dictionary.checkout.loadingSession}
          titleClassName="font-display text-primary"
          statusClassName="text-sm text-muted"
        >
          <div className={skelPulseSpace4} aria-hidden="true">
            <div className={skelH28} />
            <div className={skelH12W48} />
          </div>
        </HonestLoadingShell>
      }
    >
      <AcquireContent {...props} />
    </Suspense>
  );
}
