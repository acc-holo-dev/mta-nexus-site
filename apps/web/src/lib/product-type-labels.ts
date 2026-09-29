import type { ProductType } from "@nexus/domain";
import type { getDictionary } from "./i18n";

type Dictionary = ReturnType<typeof getDictionary>;
export const PRODUCT_CATEGORY_KEYS = {
  script: "scripts",
  vehicle: "vehicles",
  model: "models",
  map: "maps",
  ui: "ui",
  plugin: "plugins",
  api: "apis",
  bundle: "bundles",
  service: "services",
} as const satisfies Record<ProductType, keyof Dictionary["market"]>;
export const PRODUCT_PUBLISHING_KEYS = {
  script: "typeScript",
  vehicle: "typeVehicle",
  model: "typeModel",
  map: "typeMap",
  ui: "typeUi",
  plugin: "typePlugin",
  api: "typeApi",
  bundle: "typeBundle",
  service: "typeService",
} as const satisfies Record<ProductType, keyof Dictionary["publishing"]>;
