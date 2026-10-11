import { resourceMediaCommandSchema } from "@nexus/validation";
import { expect, it } from "vitest";
import { safeResourceImageUrl } from "../apps/web/src/lib/resource-image-url";
import { normalizeResourceImage } from "../apps/web/src/lib/services/resource-image-normalization";
import fixtures from "./fixtures/resource-images.json";

it.each(["png", "jpeg", "webp"] as const)(
  "fully decodes and strips metadata from %s",
  async (format) => {
    const input = Buffer.from(fixtures[format], "base64");
    const output = await normalizeResourceImage(input);
    expect(output.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(output.width).toBe(format === "jpeg" ? 16 : 32);
    expect(output.height).toBe(format === "jpeg" ? 32 : 16);
    const types = [];
    let at = 8;
    while (at + 12 <= output.bytes.length) {
      types.push(output.bytes.subarray(at + 4, at + 8).toString());
      at += output.bytes.readUInt32BE(at) + 12;
    }
    for (const type of ["eXIf", "iCCP", "tEXt", "iTXt"]) expect(types).not.toContain(type);
    expect(output.bytes.length).toBeLessThan(4 * 1024 * 1024);
  },
);
it("reduces dimensions without enlarging or distorting the image", async () => {
  const output = await normalizeResourceImage(Buffer.from(fixtures.resize, "base64"));
  expect([output.width, output.height]).toEqual([1920, 540]);
});
it.each([
  Buffer.from("<svg><script>alert(1)</script></svg>"),
  Buffer.from("GIF89a"),
  Buffer.alloc(0),
  Buffer.alloc(5 * 1024 * 1024 + 1),
  Buffer.from(fixtures.png, "base64").subarray(0, 25),
  Buffer.from(fixtures.wide, "base64"),
])("refuses unsupported, truncated or excessive input", async (bytes) => {
  await expect(normalizeResourceImage(bytes)).rejects.toMatchObject({
    code: "RESOURCE_MEDIA_INVALID",
  });
});
it("refuses PNG animation declarations before decoding", async () => {
  const png = Buffer.from(fixtures.png, "base64"),
    animation = Buffer.alloc(20);
  animation.writeUInt32BE(8);
  animation.write("acTL", 4);
  await expect(
    normalizeResourceImage(Buffer.concat([png.subarray(0, 33), animation, png.subarray(33)])),
  ).rejects.toMatchObject({ code: "RESOURCE_MEDIA_INVALID" });
});
it("bounds concurrent processing and releases capacity", async () => {
  const bytes = Buffer.from(fixtures.resize, "base64");
  const first = normalizeResourceImage(bytes),
    second = normalizeResourceImage(bytes);
  await expect(normalizeResourceImage(bytes)).rejects.toMatchObject({
    code: "RESOURCE_MEDIA_BUSY",
  });
  await Promise.all([first, second]);
  await expect(normalizeResourceImage(bytes)).resolves.toHaveProperty("width", 1920);
});
it("honors pre-existing cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    normalizeResourceImage(Buffer.from(fixtures.png, "base64"), controller.signal),
  ).rejects.toHaveProperty("name", "AbortError");
});
it.each([
  "//evil.test/a",
  "/api/resource-media/rmi_a?x=1",
  "/api/resource-media/rmi_a/other",
  "javascript:alert(1)",
  "/private/file.png",
])("refuses unsupported preview URL %s", (url) => {
  expect(safeResourceImageUrl(url)).toBeUndefined();
});
it("permits exactly the local image endpoint and retains legacy URL filtering", () => {
  expect(safeResourceImageUrl("/api/resource-media/rmi_a")).toBe("/api/resource-media/rmi_a");
  expect(safeResourceImageUrl("https://example.com/image.png")).toBe(
    "https://example.com/image.png",
  );
  expect(safeResourceImageUrl("https://user:secret@example.com/image.png")).toBeUndefined();
});
it("rejects duplicate IDs, unknown command fields and multiline captions", () => {
  const item = { id: "rmi_a", caption: "Caption" },
    input = { action: "save", expectedUpdatedAt: "2026-10-11T00:00:00.000Z", items: [item] };
  expect(resourceMediaCommandSchema.safeParse(input).success).toBe(true);
  for (const value of [
    { ...input, items: [item, item] },
    { ...input, status: "published" },
    { ...input, items: [{ ...item, caption: "line\nline" }] },
    { ...input, items: [{ ...item, id: "rmi_../x" }] },
  ])
    expect(resourceMediaCommandSchema.safeParse(value).success).toBe(false);
});
