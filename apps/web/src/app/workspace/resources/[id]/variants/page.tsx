import { NotFoundError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { ResourceVariantsForm } from "../../../../../components/resource-variants-form";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourceManagementCopy } from "../../../../../lib/resource-management-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { productService } from "../../../../../lib/services/product-service";
import { resourceManagementService } from "../../../../../lib/services/resource-management-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Resource variants | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function ResourceVariantsPage({
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
  const returnPath = `/workspace/resources/${encodeURIComponent(id)}/variants`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const product = await productService.getManagedProduct(id, actor);
  if (!product) notFound();
  const managed = await resourceManagementService.managedVariants(id, actor).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    return null;
  });
  if (!managed) {
    return (
      <div className={pageShellClass}>
        <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={navLinkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const candidates =
    managed.anchorProductId === product.id
      ? await resourceManagementService.variantCandidates(product.id, actor, 1).catch(() => null)
      : null;
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/resources/${product.id}`} className={navLinkClass}>
        {copy.back}
      </Link>
      <header>
        <h1 className="font-display text-primary">{copy.variants}</h1>
        <p className="break-words text-secondary">{product.title}</p>
      </header>
      {candidates ? (
        <ResourceVariantsForm
          key={`${product.id}:${managed.group?.id ?? "new"}:${managed.group?.revision ?? 0}`}
          product={{ id: product.id, title: product.title }}
          managed={managed}
          initialCandidates={candidates}
        />
      ) : (
        <section className="nexus-panel space-y-3 p-5">
          <p className="text-secondary">{copy.anchorNote}</p>
          <Link
            href={`/workspace/resources/${managed.anchorProductId}/variants`}
            className={navLinkClass}
          >
            {copy.manageAnchor}
          </Link>
        </section>
      )}
    </div>
  );
}
