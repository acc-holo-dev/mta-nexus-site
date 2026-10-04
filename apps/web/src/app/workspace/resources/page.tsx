import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import type { Product } from "@nexus/domain";
import { authService } from "../../../lib/services/auth-service";
import { productService } from "../../../lib/services/product-service";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Author workspace | MTA NEXUS",
  robots: { index: false, follow: false },
};
const statuses: Product["status"][] = [
  "draft",
  "pending_review",
  "published",
  "suspended",
  "archived",
];

export default async function AuthorResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const dictionary = getDictionary(await getRequestLocale());
  const copy = dictionary.authorResources;
  const user = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{dictionary.workspace.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {dictionary.workspace.signIn}
        </Link>
      </section>
    );
  const query = await searchParams;
  const status = statuses.find((value) => value === query.status);
  const result = await productService.listManagedProducts(user, status, Number(query.page ?? 1));
  const href = (page: number) =>
    `/workspace/resources?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-secondary">{copy.subtitle}</p>
        </div>
        <Link
          href="/workspace/resources/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          {dictionary.workspace.publishResource}
        </Link>
      </header>
      <nav aria-label={copy.status} className="flex flex-wrap gap-2">
        <Link
          href="/workspace/resources"
          aria-current={!status ? "page" : undefined}
          className="rounded-md border border-base px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
        >
          {copy.all}
        </Link>
        {statuses.map((value) => (
          <Link
            key={value}
            href={`/workspace/resources?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className="rounded-md border border-base px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
          >
            {copy.statusLabels[value]}
          </Link>
        ))}
      </nav>
      {result.products.length === 0 ? (
        <p className="py-10 text-secondary">{copy.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.products.map((product) => (
            <li key={product.id} className="min-w-0 rounded-lg border border-base bg-surface p-5">
              <Link
                href={`/workspace/resources/${product.id}`}
                className="break-words text-lg font-semibold text-primary hover:text-accent"
              >
                {product.title}
              </Link>
              <p className="mt-2 text-sm text-secondary">
                {copy.statusLabels[product.status]} · {product.currentVersion}
              </p>
              <p className="mt-2 break-words text-sm text-muted">{product.shortDescription}</p>
            </li>
          ))}
        </ul>
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.page} className="flex items-center gap-4 text-sm">
          {result.page > 1 && (
            <Link href={href(result.page - 1)} className="text-accent underline">
              {copy.previous}
            </Link>
          )}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={href(result.page + 1)} className="text-accent underline">
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
