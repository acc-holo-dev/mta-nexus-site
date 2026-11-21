import type { PaymentProviderCapability } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import {
  isWalletEngineEnabled,
  isWalletWithdrawEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeRoundedBorderP4SmSecondary,
  typeSemiboldPrimary,
  typeSmMuted,
  typeSpace2Sm,
  typeSpace3BorderTPt5,
  typeXlPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import { WalletAdminBatchForm } from "../wallet-admin-ops";
import { getWalletCopy } from "../wallet-i18n";

const walletPaymentService = new WalletPaymentService();

function capabilityLabel(
  copy: ReturnType<typeof getWalletCopy>,
  capability: PaymentProviderCapability,
): string {
  switch (capability) {
    case "topup":
      return copy.providersAdminCapTopup;
    case "payout":
      return copy.providersAdminCapPayout;
    case "webhook_verify":
      return copy.providersAdminCapWebhook;
    case "refund":
      return copy.providersAdminCapRefund;
    default: {
      const _exhaustive: never = capability;
      return _exhaustive;
    }
  }
}

export async function walletProvidersAdminMetadata(): Promise<Metadata> {
  return {
    title: `${getWalletCopy(await getRequestLocale()).providersAdminTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function WalletProvidersAdminScreen() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = getWalletCopy(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.providersAdminTitle}
        message={copy.loadUnavailable}
        retryHref="/admin/commerce/wallet-providers"
      />
    );
  }
  if (!user) {
    return <PlatformSignIn locale={locale} returnPath="/admin/commerce/wallet-providers" />;
  }
  if (user.role !== "admin") notFound();

  const matrix = walletPaymentService.capabilityMatrix();
  const engineOn = isWalletEngineEnabled();
  const withdrawOn = isWalletWithdrawEnabled();

  return (
    <div className={pageShellMax5xl}>
      <Link href="/admin" className={linkAccentSmRounded}>
        {copy.providersAdminBack}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.providersAdminTitle}</h1>
      <p role="note" className={typeRoundedBorderP4SmSecondary}>
        {copy.providersAdminNote}
      </p>
      <dl className={typeSpace2Sm}>
        <div>
          <dt className="text-muted">{copy.providersAdminEngine}</dt>
          <dd className={typeSemiboldPrimary}>
            {engineOn ? copy.providersAdminOn : copy.providersAdminOff}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{copy.providersAdminWithdraw}</dt>
          <dd className={typeSemiboldPrimary}>
            {withdrawOn ? copy.providersAdminOn : copy.providersAdminOff}
          </dd>
        </div>
      </dl>
      <ul className="grid gap-4 md:grid-cols-2">
        {matrix.map((row) => (
          <li key={row.id} className={panelSpace3P5}>
            <h2 className={typeSemiboldPrimary}>{row.id}</h2>
            <p className={typeSmMuted}>
              {copy.providersAdminLive}:{" "}
              {row.liveConfigured ? copy.providersAdminLiveYes : copy.providersAdminLiveNo}
            </p>
            <p className={typeXsMuted}>{copy.providersAdminCapabilities}</p>
            <ul className={typeSpace2Sm}>
              {row.capabilities.map((capability) => (
                <li key={capability}>{capabilityLabel(copy, capability)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <section className={typeSpace3BorderTPt5} aria-labelledby="wallet-admin-ops-heading">
        <h2 id="wallet-admin-ops-heading" className={typeXlPrimary}>
          {copy.providersAdminOpsTitle}
        </h2>
        {engineOn ? (
          <>
            <p role="note" className={typeRoundedBorderP4SmSecondary}>
              {copy.providersAdminOpsNote}
            </p>
            <div className="grid gap-4">
              <WalletAdminBatchForm
                actorId={user.id}
                path="/api/admin/commerce/wallet-holds/release-matured"
                title={copy.providersAdminHoldTitle}
                note={copy.providersAdminHoldNote}
                submitLabel={copy.providersAdminHoldSubmit}
                busyLabel={copy.providersAdminHoldBusy}
                successTemplate={copy.providersAdminHoldSuccess}
                failedLabel={copy.providersAdminHoldFailed}
              />
              <WalletAdminBatchForm
                actorId={user.id}
                path="/api/admin/commerce/wallet-topups/expire-stale"
                title={copy.providersAdminTopupExpireTitle}
                note={copy.providersAdminTopupExpireNote}
                submitLabel={copy.providersAdminTopupExpireSubmit}
                busyLabel={copy.providersAdminTopupExpireBusy}
                successTemplate={copy.providersAdminTopupExpireSuccess}
                failedLabel={copy.providersAdminTopupExpireFailed}
              />
              <WalletAdminBatchForm
                actorId={user.id}
                path="/api/admin/commerce/wallet-orders/expire-stale"
                title={copy.providersAdminOrderExpireTitle}
                note={copy.providersAdminOrderExpireNote}
                submitLabel={copy.providersAdminOrderExpireSubmit}
                busyLabel={copy.providersAdminOrderExpireBusy}
                successTemplate={copy.providersAdminOrderExpireSuccess}
                failedLabel={copy.providersAdminOrderExpireFailed}
              />
              {withdrawOn ? (
                <WalletAdminBatchForm
                  actorId={user.id}
                  path="/api/admin/commerce/wallet-withdrawals/expire-stale"
                  title={copy.providersAdminWithdrawExpireTitle}
                  note={copy.providersAdminWithdrawExpireNote}
                  submitLabel={copy.providersAdminWithdrawExpireSubmit}
                  busyLabel={copy.providersAdminWithdrawExpireBusy}
                  successTemplate={copy.providersAdminWithdrawExpireSuccess}
                  failedLabel={copy.providersAdminWithdrawExpireFailed}
                />
              ) : (
                <p role="note" className={typeSmMuted}>
                  {copy.providersAdminWithdrawExpireDisabled}
                </p>
              )}
            </div>
          </>
        ) : (
          <p role="note" className={typeSmMuted}>
            {copy.providersAdminOpsEngineOff}
          </p>
        )}
      </section>
    </div>
  );
}
