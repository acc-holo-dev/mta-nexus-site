import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, vi } from "vitest";
import { LocaleProvider } from "../../apps/web/src/components/locale-context";

type AcquisitionLocale = "en" | "ru";

type AcquisitionUser = {
  id: string;
  username: string;
  role: "user" | "admin";
};

export type AcquisitionUiState = {
  user: AcquisitionUser | null;
  entitled: boolean;
  canManage: boolean;
  locale: AcquisitionLocale;
  product: null | Record<string, unknown>;
  isPublic: boolean;
  builds: Array<Record<string, unknown>>;
};

export const state: AcquisitionUiState = {
  user: null,
  entitled: false,
  canManage: false,
  locale: "en",
  product: null,
  isPublic: true,
  builds: [],
};

export const productService = {
  getProductBySlug: vi.fn(async () => state.product),
  getProductDetailAccessBySlug: vi.fn(async () =>
    state.product ? { product: state.product, isPublic: state.isPublic } : null,
  ),
  canManageProduct: vi.fn(async () => state.canManage),
  getProductBuilds: vi.fn(async () => state.builds),
  getDependencyResolution: vi.fn(async () => null),
  getReverseDependencySummary: vi.fn(async () => null),
  getPublicAttribution: vi.fn(async () => ({
    organization: null,
    author: {
      displayName: "Detail Author",
      username: "detail_author",
      href: "/developers/detail_author",
    },
  })),
};

export function renderPage(element: ReactNode) {
  return renderToStaticMarkup(<LocaleProvider locale={state.locale}>{element}</LocaleProvider>);
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export function product(price = 0) {
  return {
    id: "prd_detail",
    slug: "detail-resource",
    title: "Detail Resource",
    shortDescription: "Short resource description",
    description: "A detailed resource description for the behavior test.",
    thumbnailUrl: null,
    type: "script",
    price,
    currency: "USD",
    licenseModel: "unlimited",
    currentVersion: "2.0.0",
    status: "published",
    tags: ["utility"],
    compatibility: {
      mtaMinVersion: "1.6.0",
      dependencies: [],
    },
    salesCount: 12,
    ratingAverage: 45,
    ratingCount: 4,
  };
}

export function build(id: string, version: string) {
  return {
    id,
    productId: "prd_detail",
    version,
    status: "published",
    sha256Hash: id.padEnd(64, "a").slice(0, 64),
    fileName: `${id}.zip`,
    fileSizeBytes: 4096,
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "clamav",
    scannedAt: new Date("2026-10-08T00:00:00.000Z"),
    mtaVersionTarget: "1.6.0",
    isSigned: false,
    releaseNotes: null,
  };
}

function resetResourceDetailAcquisitionUi() {
  vi.clearAllMocks();
  state.user = null;
  state.entitled = false;
  state.canManage = false;
  state.locale = "en";
  state.product = product(0);
  state.isPublic = true;
  state.builds = [build("bld_latest", "2.0.0"), build("bld_old", "1.0.0")];
}

export function setupResourceDetailAcquisitionUi() {
  beforeEach(() => {
    resetResourceDetailAcquisitionUi();
  });
}
