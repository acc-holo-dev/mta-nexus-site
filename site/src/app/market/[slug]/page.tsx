import { config } from "@nexus/config";
import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { safeResourceImageUrl } from "../../../lib/resource-image-url";
import { productService } from "../../../lib/services/product-service";

export { ProductDetailPage as default } from "../../../features/resources/detail-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [locale, product] = await Promise.all([
    getRequestLocale(),
    productService.getProductBySlug(slug),
  ]);
  const dictionary = getDictionary(locale);

  if (!product) {
    return { title: dictionary.product.notFound, robots: { index: false, follow: false } };
  }

  const description = product.shortDescription || product.description.slice(0, 155);
  const previewUrl = safeResourceImageUrl(product.thumbnailUrl);
  const thumbnailUrl = previewUrl?.startsWith("/")
    ? new URL(previewUrl, config.NEXT_PUBLIC_APP_URL).href
    : previewUrl;

  return {
    title: product.title,
    description,
    alternates: { canonical: `/market/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      type: "website",
      images: thumbnailUrl ? [{ url: thumbnailUrl }] : undefined,
    },
  };
}
