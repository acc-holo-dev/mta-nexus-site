import { NotFoundError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { resourceManagementService } from "../../../lib/services/resources/resource-management-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { getResourceManagementCopy } from "../resource-management-i18n";
import { ResourceVariantsForm } from "../variant-controls";
export async function resourceVariantsMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceManagementCopy(await getRequestLocale()).variants} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ResourceVariantsScreen({ params }: { params: Promise<{ id: string }> }) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]);
  const copy = getResourceManagementCopy(locale);
  const dictionary = getDictionary(locale);
  const returnPath = `/workspace/resources/${encodeURIComponent(id)}/variants`;
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
  const managed = await resourceManagementService.managedVariants(id, actor).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    return null;
  });
  if (!managed) {
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
  const candidates =
    managed.anchorProductId === product.id
      ? await resourceManagementService.variantCandidates(product.id, actor, 1).catch(() => null)
      : null;
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/resources/${product.id}`} className={linkAccentSm}>
        {copy.back}
      </Link>
      <header>
        <h1 className="font-display text-primary">{copy.variants}</h1>
        <p className="break-words text-secondary">{product.title}</p>
      </header>
      {candidates ? (
        <ResourceVariantsForm
          key={`${actor.id}:${product.id}`}
          actorId={actor.id}
          product={{ id: product.id, title: product.title }}
          managed={managed}
          initialCandidates={candidates}
        />
      ) : (
        <section className={panelSpace3P5}>
          <p className="text-secondary">{copy.anchorNote}</p>
          <Link
            href={`/workspace/resources/${managed.anchorProductId}/variants`}
            className={linkAccentSm}
          >
            {copy.manageAnchor}
          </Link>
        </section>
      )}
    </div>
  );
}
