import { GET as getServiceWorker } from "../../site/src/app/sw.js/route";
import { createServiceWorkerHarness, makeServiceWorkerRequest } from "./service-worker-harness";

export { createServiceWorkerHarness, makeServiceWorkerRequest };

export async function serviceWorkerSource() {
  return getServiceWorker().text();
}

export function publicDocumentResponse(options: { marker?: boolean; vary?: string } = {}) {
  const clone = { kind: "public-document-clone" };
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    ...(options.marker === false ? {} : { "X-Nexus-Offline-Cache": "public-readonly-v1" }),
    Vary: options.vary ?? "Cookie",
  });
  return {
    ok: true,
    type: "basic",
    headers,
    clone() {
      return clone;
    },
  };
}
