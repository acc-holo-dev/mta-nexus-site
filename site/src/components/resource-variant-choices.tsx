import type { PublicResourceVariants } from "@nexus/domain";
import Link from "next/link";
import { getResourceManagementCopy } from "../lib/resource-management-i18n";

export function ResourceVariantChoices({
  group,
  productId,
  locale,
}: {
  group: PublicResourceVariants | null;
  productId: string;
  locale: "ru" | "en";
}) {
  if (!group || group.variants.length < 2) return null;
  const copy = getResourceManagementCopy(locale);
  return (
    <section className="nexus-panel space-y-3 p-5" aria-label={copy.browse}>
      <h2 className="text-base font-bold text-primary">{group.title}</h2>
      <p className="text-xs text-muted">{copy.independent}</p>
      <ul className="flex flex-wrap gap-3">
        {group.variants.map((variant) => (
          <li key={variant.productId}>
            <Link
              href={`/market/${variant.slug}`}
              aria-current={variant.productId === productId ? "page" : undefined}
              className={`block rounded-lg border px-4 py-3 text-sm ${variant.productId === productId ? "border-accent text-accent" : "border-base text-secondary"}`}
            >
              <strong>{variant.label}</strong>
              <span className="block text-xs">
                {variant.title} · {copy.version} {variant.currentVersion}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
