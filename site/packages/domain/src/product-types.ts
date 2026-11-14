export const PRODUCT_TYPES = [
  "script",
  "vehicle",
  "model",
  "map",
  "ui",
  "plugin",
  "api",
  "bundle",
  "service",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && PRODUCT_TYPES.some((type) => type === value);
}
