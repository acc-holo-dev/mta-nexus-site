import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { ProductDependencyList } from "../../../../../features/resources/detail-view";
import { ResourceCompatibilityForm } from "../../../../../features/resources/compatibility-controls";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourceManagementCopy } from "../../../../../lib/resource-management-i18n";
import { resourceRequirementsCopy } from "../../../../../lib/resource-requirements-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { productService } from "../../../../../lib/services/product-service";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Resource compatibility | MTA NEXUS",
  robots: { index: false, follow: false },
};

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default async function ResourceCompatibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [locale, actor, { id }] = await Promise.all([
    getRequestLocale(),
    cookies().then((store) => authService.getSession(store.get("nexus_session")?.value)),
    params,
  ]);
  const copy = getResourceManagementCopy(locale);
  const dictionary = getDictionary(locale);
  const returnPath = `/workspace/resources/${encodeURIComponent(id)}/compatibility`;
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
