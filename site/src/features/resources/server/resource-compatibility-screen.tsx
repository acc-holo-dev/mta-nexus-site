import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeBreakSecondary, typeDisplayPrimary } from "../../shell/type-shell";
import { ResourceCompatibilityForm } from "../compatibility-controls";
import { ProductDependencyList } from "../detail-view";
import { getResourceManagementCopy } from "../resource-management-i18n";
import { resourceRequirementsCopy } from "../resource-requirements-i18n";
export async function resourceCompatibilityMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceManagementCopy(await getRequestLocale()).compatibility} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ResourceCompatibilityScreen({ params }: { params: Promise<{ id: string }> }) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]);
  const copy = getResourceManagementCopy(locale);
  const dictionary = getDictionary(locale);
  const returnPath = `/workspace/resources/${encodeURIComponent(id)}/compatibility`;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const product = await productService.getManagedProduct(id, actor);
  if (!product) notFound();
  const resolution = await productService.getDependencyResolution(product).catch(() => null);
  if (!resolution) {
    return (
      <div className={pageShellClass}>
        <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnPath} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/resources/${product.id}`} className={linkAccentSm}>
        {copy.back}
      </Link>
      <header>
        <h1 className={typeDisplayPrimary}>{copy.compatibility}</h1>
        <p className={typeBreakSecondary}>{product.title}</p>
      </header>
      <Link
        href={`/workspace/resources/${encodeURIComponent(id)}/requirements`}
        className={linkAccentSm}
      >
        {resourceRequirementsCopy(locale).title}
      </Link>
      <ResourceCompatibilityForm
        key={`${actor.id}:${product.id}`}
        actorId={actor.id}
        product={{
          id: product.id,
          updatedAt: new Date(product.updatedAt).toISOString(),
          compatibility: product.compatibility,
          suspended: product.status === "suspended" || product.status === "archived",
        }}
      />
      <ProductDependencyList
        declared={product.compatibility.dependencies ?? []}
        resolution={resolution}
        locale={locale}
      />
    </div>
  );
}
