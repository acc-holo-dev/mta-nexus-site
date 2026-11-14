import { redirect } from "next/navigation";

export default async function CheckoutCompatibilityRedirect({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string | string[] }>;
}) {
  const params = await searchParams;
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;

  redirect(productId ? `/acquire?productId=${encodeURIComponent(productId)}` : "/acquire");
}
