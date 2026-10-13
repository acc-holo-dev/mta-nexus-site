import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { open, realpath, rename, unlink } from "node:fs/promises";
import { hostname } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { ReplayCheckpoint } from "../src/lib/services/discussion-notification-replay";
import {
  assertDiscussionReplayProgress,
  parseDiscussionReplayCheckpoint,
} from "../src/lib/services/discussion-replay-checkpoint";

const maximumBytes = 4096;

type DatabaseBinding = {
  identity: string;
  adoptLegacy?: boolean;
  deliveryPolicy?: "inbox" | "inbox-and-pending-push";
};
async function readCheckpoint(
  path: string,
  from: string,
  until: string,
  database: DatabaseBinding,
) {
  let file: FileHandle;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { version: 1, from, until, cursor: null, completed: false } satisfies ReplayCheckpoint;
  }
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maximumBytes) throw Error("Invalid checkpoint file");
    // A bounded read also rejects a file that grows after stat, without loading it in memory.
    const buffer = Buffer.alloc(maximumBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maximumBytes) throw Error("Checkpoint file exceeds limit");
    const saved: unknown = JSON.parse(buffer.toString("utf8", 0, length));
    if (
      saved &&
      typeof saved === "object" &&
      !Array.isArray(saved) &&
      "version" in saved &&
      saved.version === 2
    ) {
      if (
        !("databaseIdentity" in saved) ||
        saved.databaseIdentity !== database.identity ||
        !("checkpoint" in saved)
      )
        throw Error("Checkpoint belongs to another database scope");
      const policy = "deliveryPolicy" in saved ? saved.deliveryPolicy : "inbox";
      if (policy !== (database.deliveryPolicy ?? "inbox"))
        throw Error("Checkpoint delivery policy does not match");
      return parseDiscussionReplayCheckpoint(saved.checkpoint, from, until);
    }
    if (!database.adoptLegacy || database.deliveryPolicy === "inbox-and-pending-push")
      throw Error("Legacy checkpoint requires explicit inbox-only adoption");
    return parseDiscussionReplayCheckpoint(saved, from, until);
  } finally {
    await file.close();
  }
}

/** Local durable filesystem only. Lock recovery remains an explicit operator action. */
export async function withDiscussionReplayCheckpoint<T>(
  checkpointName: string,
  from: string,
  until: string,
  database: DatabaseBinding,
  run: (store: {
    initial: ReplayCheckpoint;
    save: (value: ReplayCheckpoint) => Promise<void>;
  }) => Promise<T>,
): Promise<T> {
  // Validate even a new window before touching files. Canonical directories share one lock.
  const empty = { version: 1, from, until, cursor: null, completed: false };
  parseDiscussionReplayCheckpoint(empty, from, until);
  if (!/^[a-f0-9]{64}$/.test(database.identity))
    throw Error("Invalid checkpoint database identity");
  const binding = { ...database };
  if (
    binding.deliveryPolicy !== undefined &&
    !["inbox", "inbox-and-pending-push"].includes(binding.deliveryPolicy)
  )
    throw Error("Invalid checkpoint delivery policy");
  const requested = resolve(checkpointName);
  const directory = await realpath(dirname(requested));
  const path = join(directory, basename(requested));
  const lockPath = `${path}.lock`;
  const lock = await open(lockPath, "wx", 0o600);
  try {
    await lock.writeFile(
      JSON.stringify({
        version: 2,
        pid: process.pid,
        host: hostname(),
        from,
        until,
        databaseIdentity: binding.identity,
        ...(binding.deliveryPolicy === "inbox-and-pending-push"
          ? { deliveryPolicy: binding.deliveryPolicy }
          : {}),
      }),
    );
    await lock.sync();
    const initial = await readCheckpoint(path, from, until, binding);
    let persisted = parseDiscussionReplayCheckpoint(initial, from, until),
      saving = false;
    const save = async (value: ReplayCheckpoint) => {
      if (saving) throw Error("Concurrent checkpoint writes are not allowed");
      const normalized = parseDiscussionReplayCheckpoint(value, from, until);
      assertDiscussionReplayProgress(persisted, normalized);
      const payload = JSON.stringify({
        version: 2,
        databaseIdentity: binding.identity,
        ...(binding.deliveryPolicy === "inbox-and-pending-push"
          ? { deliveryPolicy: binding.deliveryPolicy }
          : {}),
        checkpoint: normalized,
      });
      if (Buffer.byteLength(payload) > maximumBytes) throw Error("Checkpoint file exceeds limit");
      // Exclusive, unpredictable creation never truncates a leftover temporary file or symlink.
      const temporary = join(directory, `.${basename(path)}.${randomUUID()}.tmp`);
      saving = true;
      let created = false;
      try {
        const file = await open(temporary, "wx", 0o600);
        created = true;
        try {
          await file.writeFile(payload);
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, path);
        // Persist the replacement's directory entry before reporting the cursor as saved.
        const parent = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
        try {
          await parent.sync();
        } finally {
          await parent.close();
        }
        persisted = normalized;
      } finally {
        try {
          if (created)
            await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
              if (error.code !== "ENOENT") throw error;
            });
        } finally {
          saving = false;
        }
      }
    };
    return await run({ initial, save });
  } finally {
    try {
      await lock.close();
    } finally {
      await unlink(lockPath);
    }
  }
}
