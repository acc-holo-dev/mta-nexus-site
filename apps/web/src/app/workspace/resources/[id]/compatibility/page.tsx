import {resourceRequirementsCopy} from "../../../../../lib/resource-requirements-i18n";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDependencyList } from "../../../../../components/product-dependency-list";
import { ResourceCompatibilityForm } from "../../../../../components/resource-compatibility-form";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourceManagementCopy } from "../../../../../lib/resource-management-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { productService } from "../../../../../lib/services/product-service";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Resource compatibility | MTA NEXUS",
  robots: { index: false, follow: false },
};
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
  const resolution = await productService.getDependencyResolution(product);
  return (
    <div className="space-y-6">
      <Link href={`/workspace/resources/${product.id}`} className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <header>
        <h1 className="font-display text-primary">{copy.compatibility}</h1>
        <p className="break-words text-secondary">{product.title}</p>
      </header>
      <Link href={`/workspace/resources/${encodeURIComponent(id)}/requirements`} className="text-accent underline">{resourceRequirementsCopy(locale).title}</Link>
      <ResourceCompatibilityForm
        key={`${product.id}:${new Date(product.updatedAt).toISOString()}`}
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
