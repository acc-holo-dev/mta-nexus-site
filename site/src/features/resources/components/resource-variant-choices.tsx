import type { PublicResourceVariants } from "@nexus/domain";
import Link from "next/link";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { typeFlexWrapGap3, typeXsMuted } from "../../shell/type-shell";
import { getResourceManagementCopy } from "../resource-management-i18n";

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
    <section className={panelSpace3P5} aria-label={copy.browse}>
      <h2 className="text-base font-bold text-primary">{group.title}</h2>
      <p className={typeXsMuted}>{copy.independent}</p>
      <ul className={typeFlexWrapGap3}>
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
