import { NotFoundError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceVariantsForm } from "../../../../../components/resource-variants-form";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourceManagementCopy } from "../../../../../lib/resource-management-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { productService } from "../../../../../lib/services/product-service";
import { resourceManagementService } from "../../../../../lib/services/resource-management-service";

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
  const copy = getResourceManagementCopy(locale),
    dictionary = getDictionary(locale);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{dictionary.workspace.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {dictionary.workspace.signIn}
        </Link>
      </section>
    );
  const product = await productService.getManagedProduct(id, actor);
  if (!product) notFound();
  const managed = await resourceManagementService.managedVariants(id, actor).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const candidates =
    managed.anchorProductId === product.id
      ? await resourceManagementService.variantCandidates(product.id, actor, 1)
      : null;
  return (
    <div className="space-y-6">
      <Link href={`/workspace/resources/${product.id}`} className="text-sm text-accent underline">
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
            className="text-accent underline"
          >
            {copy.manageAnchor}
          </Link>
        </section>
      )}
    </div>
  );
}
