import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { ResourceCompatibilityForm } from "../compatibility-controls";
import { ProductDependencyList } from "../detail-view";
import { getResourceManagementCopy } from "../resource-management-i18n";
import { resourceRequirementsCopy } from "../resource-requirements-i18n";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
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
        <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={navLinkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/resources/${product.id}`} className={navLinkClass}>
        {copy.back}
      </Link>
      <header>
        <h1 className="font-display text-primary">{copy.compatibility}</h1>
        <p className="break-words text-secondary">{product.title}</p>
      </header>
      <Link
        href={`/workspace/resources/${encodeURIComponent(id)}/requirements`}
        className={navLinkClass}
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
