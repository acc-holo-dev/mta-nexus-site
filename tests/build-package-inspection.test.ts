import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/build-packages.json";
import { buildPackageSummary } from "@nexus/domain";
import { inspectBuildPackage } from "../apps/web/src/lib/services/build-package-inspection";
import { buildPackageCopy } from "../apps/web/src/lib/build-package-i18n";
import { getResourceSubmissionErrorMessage } from "../apps/web/src/lib/publishing-error-message";

const bytes = (name: keyof typeof fixtures) => Buffer.from(fixtures[name], "base64");
const inspect = (data: Uint8Array) => inspectBuildPackage({ bytes: data, format: "zip" });
describe("actual uploaded package inspection", () => {
  it.each(["stored", "deflated", "descriptor"] as const)(
    "checks Python-generated %s archives and exact integrity",
    async (format) => {
      const data = bytes(format),
        report = await inspect(data);
      expect(report.sha256Hash).toBe(createHash("sha256").update(data).digest("hex"));
      expect(report.fileSizeBytes).toBe(data.length);
      expect(report).toMatchObject({
        status: "checked",
        archive: { entries: 4, files: 4 },
        manifestStatus: "single",
      });
      expect(report.manifest).toMatchObject({
        path: "demo/meta.xml",
        root: "meta",
        parser: "best_effort_static",
        scripts: { server: 1, client: 1, shared: 1, unknown: 0 },
        dependencies: ["scoreboard"],
        aclRights: ["function.fetchRemote"],
        minimumMta: { server: "1.6.0" },
      });
      expect(report.manifest?.references).toEqual([
        { kind: "script", path: "server.lua", status: "present" },
        { kind: "script", path: "client.lua", status: "present" },
        { kind: "script", path: "shared.lua", status: "present" },
        { kind: "file", path: "missing.png", status: "missing" },
        { kind: "file", path: "*.png", status: "pattern" },
        { kind: "config", path: ":other/config.xml", status: "external" },
      ]);
      const summary = JSON.stringify(buildPackageSummary(report));
      for (const privateValue of [
        "demo/",
        "server.lua",
        "scoreboard",
        "fetchRemote",
        report.sha256Hash,
      ])
        expect(summary).not.toContain(privateValue);
      expect(buildPackageSummary(report)).toMatchObject({
        missingReferences: 1,
        unresolvedReferences: 2,
      });
    },
  );
  it.each([
    "traversal",
    "absolute",
    "backslash",
    "drive",
    "device",
    "trailingDot",
    "control",
    "symlink",
    "duplicate",
    "parentFile",
  ] as const)("rejects extraction ambiguity: %s", async (name) => {
    await expect(inspect(bytes(name))).rejects.toMatchObject({
      code: "BUILD_PACKAGE_UNSAFE_PATH",
      statusCode: 422,
    });
  });
  it.each(["directory", "unicode"] as const)(
    "accepts supported %s names and entries",
    async (name) => {
      await expect(inspect(bytes(name))).resolves.toMatchObject({ status: "checked" });
    },
  );
  it("checks every entry's CRC, not only the manifest", async () => {
    const data = bytes("stored"),
      script = data.indexOf('print("server")');
    data[script] = (data[script] ?? 0) ^ 1;
    await expect(inspect(data)).rejects.toMatchObject({ code: "BUILD_PACKAGE_INVALID" });
  });
  it("rejects truncated directories, prepended/extra payload and local header mismatch", async () => {
    const original = bytes("stored"),
      mismatch = Buffer.from(original);
    mismatch.writeUInt16LE(8, 8);
    for (const data of [
      original.subarray(0, original.length - 1),
      Buffer.concat([original, Buffer.from("payload")]),
      Buffer.concat([Buffer.from("prefix"), original]),
      mismatch,
      Buffer.from("PK\x03\x04"),
    ]) {
      await expect(inspect(data)).rejects.toMatchObject({ code: "BUILD_PACKAGE_INVALID" });
    }
  });
  it("rejects encryption, unsupported methods and ZIP64 before inflation", async () => {
    for (const [offset, value] of [
      [8, 1],
      [10, 99],
      [6, 45],
    ]) {
      const data = bytes("stored"),
        central = data.indexOf(Buffer.from([0x50, 0x4b, 1, 2]));
      if (offset === undefined || value === undefined) throw new Error("fixture");
      data.writeUInt16LE(value, central + offset);
      await expect(inspect(data)).rejects.toMatchObject({ code: "BUILD_PACKAGE_UNSUPPORTED" });
    }
  });
  it.each(["ratio", "largeMeta"] as const)("enforces bounded %s output", async (name) => {
    await expect(inspect(bytes(name))).rejects.toMatchObject({
      code: "BUILD_PACKAGE_LIMIT_EXCEEDED",
    });
  });
  it("rejects DTDs without reading external entities", async () => {
    await expect(inspect(bytes("metaDTD"))).rejects.toMatchObject({
      code: "BUILD_PACKAGE_UNSUPPORTED",
    });
  });
  it("records absent and multiple manifests without inventing runnable-resource facts", async () => {
    expect(await inspect(bytes("missingManifest"))).toMatchObject({
      manifestStatus: "missing",
      manifest: null,
    });
    expect(await inspect(bytes("multipleManifest"))).toMatchObject({
      manifestStatus: "multiple",
      manifest: null,
    });
  });
  it.each(["rar", "7z", "lua"] as const)("does not claim inspection for %s", async (format) => {
    expect(await inspectBuildPackage({ bytes: Buffer.from("sample"), format })).toMatchObject({
      status: "not_inspected",
      archive: null,
      manifestStatus: "not_inspected",
      manifest: null,
    });
  });
  it("honors cancellation before decompression", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      inspectBuildPackage({ bytes: bytes("deflated"), format: "zip", signal: controller.signal }),
    ).rejects.toThrow();
  });
  it("bounds concurrent inflation and releases capacity after success or failure", async () => {
    const results = await Promise.allSettled([
      inspect(bytes("deflated")),
      inspect(bytes("deflated")),
      inspect(bytes("deflated")),
    ]);
    expect(results.filter((v) => v.status === "fulfilled")).toHaveLength(2);
    expect(results.find((v) => v.status === "rejected")).toMatchObject({
      status: "rejected",
      reason: { code: "BUILD_PACKAGE_INSPECTOR_BUSY", statusCode: 503 },
    });
    await expect(inspect(Buffer.from("bad"))).rejects.toMatchObject({
      code: "BUILD_PACKAGE_INVALID",
    });
    await expect(inspect(bytes("deflated"))).resolves.toMatchObject({ status: "checked" });
  });
  it("does not expose future arbitrary script fields through a public projection", async () => {
    const report = await inspect(bytes("stored"));
    Object.assign(report.manifest?.scripts ?? {}, { secret: "private" });
    expect(JSON.stringify(buildPackageSummary(report))).not.toContain("private");
    expect(buildPackageSummary(null)).toBeNull();
  });
  it.each(["ru", "en"] as const)("localizes package failures in %s", (locale) => {
    for (const key of ["invalid", "unsupported", "path", "limit"] as const)
      expect(buildPackageCopy(locale)[key]).toBeTruthy();
    expect(
      getResourceSubmissionErrorMessage("BUILD_PACKAGE_INVALID", {
        fileTooLarge: "size",
        malwareDetected: "malware",
        scanLimitExceeded: "limit",
        scannerUnavailable: "offline",
        packageInvalid: "package",
      }),
    ).toBe("package");
  });
});
