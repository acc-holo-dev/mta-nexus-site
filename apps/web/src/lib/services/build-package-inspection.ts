import { createHash } from "node:crypto";
import { inflateRaw } from "node:zlib";
import { AppError, MAX_UPLOAD_FILE_SIZE_BYTES, type BuildPackageEvidence } from "@nexus/domain";
import { inspectMtaMetaXml, MetaInspectionInputError } from "../mta-meta-inspector";

export const packageInspectionLimits = Object.freeze({
  entries: 1000,
  unpackedBytes: 128 * 1024 * 1024,
  entryBytes: 64 * 1024 * 1024,
  ratio: 100,
  metaBytes: 256 * 1024,
  references: 200,
  evidenceBytes: 768 * 1024,
});
const fail = (
  code:
    | "BUILD_PACKAGE_INVALID"
    | "BUILD_PACKAGE_UNSUPPORTED"
    | "BUILD_PACKAGE_UNSAFE_PATH"
    | "BUILD_PACKAGE_LIMIT_EXCEEDED",
) => new AppError("The package cannot be inspected safely", 422, code);
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let v = n;
  for (let bit = 0; bit < 8; bit++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
  return v >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = (crc >>> 8) ^ (crcTable[(crc ^ b) & 255] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
}
function safePath(value: string, directory = false) {
  const path = directory && value.endsWith("/") ? value.slice(0, -1) : value;
  return (
    path.length > 0 &&
    Buffer.byteLength(path, "utf8") <= 512 &&
    !/[\\:\p{Cf}]/u.test(path) &&
    !Array.from(path).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) &&
    !path.startsWith("/") &&
    path
      .split("/")
      .every(
        (part) =>
          part !== "" &&
          part !== "." &&
          part !== ".." &&
          !/[. ]$/u.test(part) &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part),
      )
  );
}
function name(bytes: Buffer, flags: number) {
  if (!(flags & 0x800) && bytes.some((b) => b > 127)) throw fail("BUILD_PACKAGE_UNSUPPORTED");
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw fail("BUILD_PACKAGE_INVALID");
  }
}
function extras(bytes: Buffer) {
  let p = 0;
  while (p < bytes.length) {
    if (p + 4 > bytes.length) throw fail("BUILD_PACKAGE_INVALID");
    const tag = bytes.readUInt16LE(p),
      length = bytes.readUInt16LE(p + 2);
    if ([0x0001, 0x9901, 0x7075].includes(tag)) throw fail("BUILD_PACKAGE_UNSUPPORTED");
    p += 4 + length;
    if (p > bytes.length) throw fail("BUILD_PACKAGE_INVALID");
  }
}
type Entry = {
  path: string;
  directory: boolean;
  flags: number;
  method: number;
  crc: number;
  packed: number;
  size: number;
  offset: number;
  data: number;
  end: number;
};

function zipDirectory(bytes: Buffer): Entry[] {
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 65535); p--) {
    if (
      bytes.readUInt32LE(p) === 0x06054b50 &&
      p + 22 + bytes.readUInt16LE(p + 20) === bytes.length
    ) {
      end = p;
      break;
    }
  }
  if (end < 0) throw fail("BUILD_PACKAGE_INVALID");
  const count = bytes.readUInt16LE(end + 10),
    centralSize = bytes.readUInt32LE(end + 12),
    central = bytes.readUInt32LE(end + 16);
  if (
    bytes.readUInt16LE(end + 4) ||
    bytes.readUInt16LE(end + 6) ||
    bytes.readUInt16LE(end + 8) !== count ||
    count === 65535 ||
    central === 0xffffffff ||
    centralSize === 0xffffffff
  )
    throw fail("BUILD_PACKAGE_UNSUPPORTED");
  if (!count) throw fail("BUILD_PACKAGE_INVALID");
  if (count > packageInspectionLimits.entries) throw fail("BUILD_PACKAGE_LIMIT_EXCEEDED");
  if (central + centralSize !== end) throw fail("BUILD_PACKAGE_INVALID");
  const entries: Entry[] = [],
    names = new Set<string>();
  let p = central,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || bytes.readUInt32LE(p) !== 0x02014b50) throw fail("BUILD_PACKAGE_INVALID");
    const flags = bytes.readUInt16LE(p + 8),
      method = bytes.readUInt16LE(p + 10),
      packed = bytes.readUInt32LE(p + 20),
      size = bytes.readUInt32LE(p + 24),
      offset = bytes.readUInt32LE(p + 42);
    const nameLength = bytes.readUInt16LE(p + 28),
      extraLength = bytes.readUInt16LE(p + 30),
      commentLength = bytes.readUInt16LE(p + 32);
    if (
      flags & ~0x080e ||
      ![0, 8].includes(method) ||
      (method === 0 && flags & 6) ||
      bytes.readUInt16LE(p + 34) ||
      bytes.readUInt16LE(p + 6) > 20
    )
      throw fail("BUILD_PACKAGE_UNSUPPORTED");
    if (p + 46 + nameLength + extraLength + commentLength > end)
      throw fail("BUILD_PACKAGE_INVALID");
    const rawName = bytes.subarray(p + 46, p + 46 + nameLength),
      path = name(rawName, flags),
      directory = path.endsWith("/");
    if (!safePath(path, directory)) throw fail("BUILD_PACKAGE_UNSAFE_PATH");
    const folded = path.normalize("NFC").toLowerCase().replace(/\/$/u, "");
    if (names.has(folded)) throw fail("BUILD_PACKAGE_UNSAFE_PATH");
    names.add(folded);
    const unixType = (bytes.readUInt32LE(p + 38) >>> 16) & 0xf000;
    if (
      (unixType && unixType !== (directory ? 0x4000 : 0x8000)) ||
      (Boolean(bytes.readUInt32LE(p + 38) & 0x10) !== directory &&
        (bytes.readUInt32LE(p + 38) & 0x10) !== 0)
    )
      throw fail("BUILD_PACKAGE_UNSAFE_PATH");
    extras(bytes.subarray(p + 46 + nameLength, p + 46 + nameLength + extraLength));
    total += size;
    if (
      size > packageInspectionLimits.entryBytes ||
      total > packageInspectionLimits.unpackedBytes ||
      (size > 1024 * 1024 && size > Math.max(1, packed) * packageInspectionLimits.ratio)
    )
      throw fail("BUILD_PACKAGE_LIMIT_EXCEEDED");
    if (offset + 30 > central || bytes.readUInt32LE(offset) !== 0x04034b50)
      throw fail("BUILD_PACKAGE_INVALID");
    const localNameLength = bytes.readUInt16LE(offset + 26),
      localExtraLength = bytes.readUInt16LE(offset + 28),
      data = offset + 30 + localNameLength + localExtraLength;
    if (
      data + packed > central ||
      bytes.readUInt16LE(offset + 4) !== bytes.readUInt16LE(p + 6) ||
      bytes.readUInt16LE(offset + 6) !== flags ||
      bytes.readUInt16LE(offset + 8) !== method ||
      !bytes.subarray(offset + 30, offset + 30 + localNameLength).equals(rawName)
    )
      throw fail("BUILD_PACKAGE_INVALID");
    extras(bytes.subarray(offset + 30 + localNameLength, data));
    const crc = bytes.readUInt32LE(p + 16);
    for (const [position, expected] of [
      [14, crc],
      [18, packed],
      [22, size],
    ]) {
      if (position === undefined || expected === undefined) throw fail("BUILD_PACKAGE_INVALID");
      const actual = bytes.readUInt32LE(offset + position);
      if (actual !== expected && (!(flags & 8) || actual !== 0))
        throw fail("BUILD_PACKAGE_INVALID");
    }
    let entryEnd = data + packed;
    if (flags & 8) {
      if (entryEnd + 12 > central) throw fail("BUILD_PACKAGE_INVALID");
      // The optional descriptor signature can equal a real CRC; accept only a matching full tuple.
      const signature =
        bytes.readUInt32LE(entryEnd) === 0x08074b50 &&
        entryEnd + 16 <= central &&
        bytes.readUInt32LE(entryEnd + 4) === crc &&
        bytes.readUInt32LE(entryEnd + 8) === packed &&
        bytes.readUInt32LE(entryEnd + 12) === size;
      const descriptor = entryEnd + (signature ? 4 : 0);
      if (
        bytes.readUInt32LE(descriptor) !== crc ||
        bytes.readUInt32LE(descriptor + 4) !== packed ||
        bytes.readUInt32LE(descriptor + 8) !== size
      )
        throw fail("BUILD_PACKAGE_INVALID");
      entryEnd = descriptor + 12;
    }
    if ((directory && size !== 0) || (method === 0 && size !== packed))
      throw fail("BUILD_PACKAGE_INVALID");
    entries.push({
      path,
      directory,
      flags,
      method,
      packed,
      size,
      offset,
      data,
      end: entryEnd,
      crc,
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  if (p !== end) throw fail("BUILD_PACKAGE_INVALID");
  const spans = [...entries].sort((a, b) => a.offset - b.offset);
  let boundary = 0;
  for (const entry of spans) {
    if (entry.offset !== boundary) throw fail("BUILD_PACKAGE_INVALID");
    boundary = entry.end;
  }
  if (boundary !== central) throw fail("BUILD_PACKAGE_INVALID");
  // A file cannot also serve as a parent directory on common extraction targets.
  const files = new Set(
    entries
      .filter((entry) => !entry.directory)
      .map((entry) => entry.path.normalize("NFC").toLowerCase()),
  );
  for (const entry of entries) {
    const parts = entry.path.normalize("NFC").toLowerCase().split("/");
    for (let n = 1; n < parts.length; n++)
      if (files.has(parts.slice(0, n).join("/"))) throw fail("BUILD_PACKAGE_UNSAFE_PATH");
  }
  return entries;
}

async function unpack(bytes: Buffer, entry: Entry) {
  const source = bytes.subarray(entry.data, entry.data + entry.packed);
  if (entry.method === 0) return source;
  return new Promise<Buffer>((resolve, reject) =>
    inflateRaw(
      source,
      { maxOutputLength: Math.max(1, entry.size), info: true },
      (error, result) => {
        if (error) return reject(fail("BUILD_PACKAGE_INVALID"));
        // Reject trailing compressed bytes which another reader could interpret differently.
        const info: unknown = result;
        if (
          typeof info !== "object" ||
          info === null ||
          !("buffer" in info) ||
          !Buffer.isBuffer(info.buffer) ||
          !("engine" in info) ||
          typeof info.engine !== "object" ||
          info.engine === null ||
          !("bytesWritten" in info.engine) ||
          info.engine.bytesWritten !== source.length
        )
          return reject(fail("BUILD_PACKAGE_INVALID"));
        resolve(info.buffer);
      },
    ),
  );
}
function manifestEvidence(
  path: string,
  content: Buffer,
  paths: Set<string>,
): NonNullable<BuildPackageEvidence["manifest"]> {
  let xml: string;
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw fail("BUILD_PACKAGE_INVALID");
  }
  let inspection: ReturnType<typeof inspectMtaMetaXml>;
  try {
    inspection = inspectMtaMetaXml(xml);
  } catch (error) {
    if (error instanceof MetaInspectionInputError)
      throw fail(
        error.code === "META_TOO_LARGE"
          ? "BUILD_PACKAGE_LIMIT_EXCEEDED"
          : "BUILD_PACKAGE_UNSUPPORTED",
      );
    throw error;
  }
  const base = path.slice(0, path.lastIndexOf("/") + 1);
  const refs: NonNullable<BuildPackageEvidence["manifest"]>["references"] = [];
  let referenceCount = 0;
  const groups = {
    script: inspection.scripts,
    file: inspection.files,
    map: inspection.maps,
    config: inspection.configs,
    html: inspection.html,
  };
  for (const [kind, items] of Object.entries(groups))
    for (const item of items) {
      referenceCount++;
      if (refs.length >= packageInspectionLimits.references) continue;
      const src = (item.src ?? "").trim();
      const status = src.startsWith(":")
        ? "external"
        : !safePath(src)
          ? "unsafe"
          : ["*", "?", "[", "]"].some((pattern) => src.includes(pattern))
            ? "pattern"
            : paths.has(base + src)
              ? "present"
              : "missing";
      refs.push({ kind: kind as (typeof refs)[number]["kind"], path: src.slice(0, 512), status });
    }
  return {
    path,
    sha256Hash: hash(content),
    byteLength: content.length,
    parser: "best_effort_static",
    root: inspection.root,
    scripts: {
      client: inspection.summary.clientScripts,
      server: inspection.summary.serverScripts,
      shared: inspection.summary.sharedScripts,
      unknown: inspection.summary.unknownScriptTypes,
    },
    minimumMta: inspection.minMtaVersion
      ? {
          client:
            inspection.minMtaVersion.client && inspection.minMtaVersion.client.length <= 40
              ? inspection.minMtaVersion.client
              : null,
          server:
            inspection.minMtaVersion.server && inspection.minMtaVersion.server.length <= 40
              ? inspection.minMtaVersion.server
              : null,
          both:
            inspection.minMtaVersion.both && inspection.minMtaVersion.both.length <= 40
              ? inspection.minMtaVersion.both
              : null,
        }
      : null,
    dependencies: inspection.dependencyResources.slice(0, 100).map((v) => v.slice(0, 120)),
    aclRights: inspection.aclRights.slice(0, 100).map((v) => (v.name ?? "").slice(0, 200)),
    references: refs,
    referencesTruncated:
      referenceCount > refs.length ||
      inspection.issues.some((v) =>
        /^(SCRIPT|FILE|MAP|CONFIG|HTML)_ENTRY_LIMIT_REACHED$/u.test(v.code),
      ),
    issues: inspection.issues.map((v) => ({ code: v.code, severity: v.severity })),
  };
}

/** Bounded, non-extracting ZIP subset inspection. Other formats explicitly remain uninspected. */
async function inspectPackageBytes(input: {
  bytes: Uint8Array;
  format: BuildPackageEvidence["format"];
  signal?: AbortSignal;
}): Promise<BuildPackageEvidence> {
  input.signal?.throwIfAborted();
  if (!input.bytes.byteLength) throw fail("BUILD_PACKAGE_INVALID");
  if (input.bytes.byteLength > MAX_UPLOAD_FILE_SIZE_BYTES)
    throw fail("BUILD_PACKAGE_LIMIT_EXCEEDED");
  const bytes = Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength);
  const evidence: BuildPackageEvidence = {
    files: null,
    schemaVersion: 1,
    inspector: "nexus-package-v1",
    format: input.format,
    status: "not_inspected",
    sha256Hash: hash(bytes),
    fileSizeBytes: bytes.length,
    inspectedAt: new Date().toISOString(),
    archive: null,
    manifestStatus: "not_inspected",
    manifest: null,
  };
  input.signal?.throwIfAborted();
  if (input.format !== "zip") return evidence;
  const entries = zipDirectory(bytes),
    candidates = entries.filter(
      (v) => !v.directory && v.path.split("/").at(-1)?.toLowerCase() === "meta.xml",
    );
  const paths = new Set(entries.filter((v) => !v.directory).map((v) => v.path));
  evidence.files = [];
  for (const entry of entries) {
    input.signal?.throwIfAborted();
    if (
      candidates.length === 1 &&
      entry === candidates[0] &&
      entry.size > packageInspectionLimits.metaBytes
    )
      throw fail("BUILD_PACKAGE_LIMIT_EXCEEDED");
    const content = await unpack(bytes, entry);
    if (content.length !== entry.size || crc32(content) !== entry.crc)
      throw fail("BUILD_PACKAGE_INVALID");
    if (!entry.directory)
      evidence.files.push({
        path: entry.path,
        sha256Hash: hash(content),
        fileSizeBytes: content.length,
      });
    if (candidates.length === 1 && entry === candidates[0])
      evidence.manifest = manifestEvidence(entry.path, content, paths);
  }
  input.signal?.throwIfAborted();
  evidence.status = "checked";
  evidence.files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  evidence.archive = {
    entries: entries.length,
    files: paths.size,
    unpackedBytes: entries.reduce((sum, v) => sum + v.size, 0),
  };
  evidence.manifestStatus =
    candidates.length === 1 ? "single" : candidates.length ? "multiple" : "missing";
  // Leave space for PostgreSQL jsonb's canonical whitespace inside the 1 MiB storage envelope.
  if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > packageInspectionLimits.evidenceBytes)
    throw fail("BUILD_PACKAGE_LIMIT_EXCEEDED");
  return evidence;
}

// Bound concurrent decompression in each application process without queuing retained upload buffers.
let activeZipInspections = 0;
export async function inspectBuildPackage(input: Parameters<typeof inspectPackageBytes>[0]) {
  if (input.format !== "zip") return inspectPackageBytes(input);
  if (activeZipInspections >= 2)
    throw new AppError(
      "Package inspection is busy; retry shortly",
      503,
      "BUILD_PACKAGE_INSPECTOR_BUSY",
    );
  activeZipInspections++;
  try {
    return await inspectPackageBytes(input);
  } finally {
    activeZipInspections--;
  }
}
