import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import images from "./fixtures/resource-images.json";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  managed: vi.fn(),
  upload: vi.fn(),
  command: vi.fn(),
  authorize: vi.fn(),
  storage: vi.fn(),
}));
vi.mock("@nexus/db", () => ({ resourceMediaRepository: { authorizeImage: state.authorize } }));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("@nexus/storage", () => ({ storageService: { getDownloadStream: state.storage } }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-media-service", () => ({
  resourceMediaService: { managed: state.managed, upload: state.upload, command: state.command },
}));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "trusted-ip",
}));

import { GET, PATCH, POST } from "../apps/web/src/app/api/products/[id]/media/route";
import { resourceMediaImage } from "../apps/web/src/lib/resource-media-image-http";

const stamp = "2026-10-11T00:00:00.000Z",
  context = { params: Promise.resolve({ id: "prd_a" }) };
const png = Buffer.from(images.png, "base64"),
  digest = createHash("sha256").update(png).digest("hex");
const gallery = { product: { id: "prd_a", status: "draft", updatedAt: stamp }, items: [] };
function uploadRequest(revision = stamp, fields?: (form: FormData) => void) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(png)], "image.png", { type: "image/png" }));
  form.set("caption", "Caption");
  form.set("expectedUpdatedAt", revision);
  fields?.(form);
  return new NextRequest("https://nexus.test/api/products/prd_a/media", {
    method: "POST",
    body: form,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a" };
  state.rate.mockResolvedValue({ success: true });
  state.managed.mockResolvedValue(gallery);
  state.upload.mockResolvedValue(gallery);
  state.command.mockResolvedValue(gallery);
  state.authorize.mockResolvedValue({
    storageKey: "assets/private.png",
    sha256Hash: digest,
    fileSizeBytes: png.length,
  });
  state.storage.mockImplementation(async () => ({
    stream: Readable.from([png]),
    meta: { key: "assets/private.png", sha256Hash: digest, sizeBytes: png.length },
  }));
});
it("uploads bounded original bytes only after session, rate and management preflight", async () => {
  const response = await POST(uploadRequest(), context);
  expect(response.status).toBe(201);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
  expect(state.upload).toHaveBeenCalledWith(
    expect.objectContaining({
      productId: "prd_a",
      actorId: "usr_a",
      bytes: png,
      caption: "Caption",
      expectedUpdatedAt: stamp,
    }),
  );
});
it("rejects unauthenticated upload before rate, body or product reads", async () => {
  state.actor = null;
  const request = uploadRequest(),
    parse = vi.spyOn(request, "formData");
  expect((await POST(request, context)).status).toBe(401);
  expect(state.managed).not.toHaveBeenCalled();
  expect(parse).not.toHaveBeenCalled();
});
it("preflight rejects revoked management rights before the body is parsed", async () => {
  state.managed.mockRejectedValue(new AppError("Missing", 404, "NOT_FOUND"));
  expect((await POST(uploadRequest(), context)).status).toBe(404);
  expect(state.upload).not.toHaveBeenCalled();
});
it("rejects cross-site upload and exhausted rate limits", async () => {
  const request = uploadRequest();
  request.headers.set("sec-fetch-site", "cross-site");
  expect((await POST(request, context)).status).toBe(403);
  expect(state.managed).not.toHaveBeenCalled();
  state.rate.mockResolvedValue({ success: false });
  expect((await POST(uploadRequest(), context)).status).toBe(429);
});
it.each([
  (form: FormData) => form.append("caption", "Duplicate"),
  (form: FormData) => form.set("storageKey", "foreign"),
  (form: FormData) => form.set("caption", "multiline\ncaption"),
])("rejects duplicate, unknown or malformed form metadata", async (fields) => {
  expect((await POST(uploadRequest(stamp, fields), context)).status).toBeGreaterThanOrEqual(400);
  expect(state.upload).not.toHaveBeenCalled();
});
it("rejects a stale revision before processing images", async () => {
  expect((await POST(uploadRequest("2026-10-10T00:00:00.000Z"), context)).status).toBe(409);
  expect(state.upload).not.toHaveBeenCalled();
});
it("read and reorder endpoints use existing inspection/content rate policies", async () => {
  expect(
    (await GET(new NextRequest("https://nexus.test/api/products/prd_a/media"), context)).status,
  ).toBe(200);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  const request = new NextRequest("https://nexus.test/api/products/prd_a/media", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save", expectedUpdatedAt: stamp, items: [] }),
  });
  expect((await PATCH(request, context)).status).toBe(200);
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
});
it("serves only fully verified PNG bytes with private no-store and browser safety headers", async () => {
  state.actor = null;
  const response = await resourceMediaImage(
    new NextRequest("https://nexus.test/api/resource-media/rmi_a"),
    "rmi_a",
  );
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(state.authorize).toHaveBeenCalledWith("rmi_a", undefined);
});
it("never opens storage after public/private authorization is refused", async () => {
  state.authorize.mockRejectedValue(new AppError("Missing", 404, "NOT_FOUND"));
  const response = await resourceMediaImage(
    new NextRequest("https://nexus.test/api/resource-media/rmi_a"),
    "rmi_a",
  );
  expect(response.status).toBe(404);
  expect(state.storage).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain("assets/");
});
it.each(["truncated", "tampered", "oversized", "metadata"])(
  "refuses %s storage output without emitting image bytes",
  async (kind) => {
    const stream = Readable.from([
      kind === "truncated"
        ? png.subarray(0, -1)
        : kind === "oversized"
          ? Buffer.concat([png, Buffer.from("x")])
          : kind === "tampered"
            ? Buffer.alloc(png.length)
            : png,
    ]);
    state.storage.mockResolvedValue({
      stream,
      meta: { sha256Hash: kind === "metadata" ? "b".repeat(64) : digest, sizeBytes: png.length },
    });
    const response = await resourceMediaImage(
      new NextRequest("https://nexus.test/api/resource-media/rmi_a"),
      "rmi_a",
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Content-Type")).not.toBe("image/png");
    expect(stream.destroyed).toBe(true);
  },
);
