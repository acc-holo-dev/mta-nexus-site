import { mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { replayDiscussionNotifications } from "../apps/web/src/lib/services/discussion-notification-replay";

const fault = vi.hoisted(() => ({ stage: "", events: [] as string[] }));
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    rename: async (...args: Parameters<typeof actual.rename>) => {
      fault.events.push("rename");
      if (fault.stage === "rename") throw Error("Injected rename failure");
      return actual.rename(...args);
    },
    open: async (...args: Parameters<typeof actual.open>) => {
      const file = await actual.open(...args);
      const temporary = String(args[0]).endsWith(".tmp");
      const directory = (await file.stat()).isDirectory();
      return new Proxy(file, {
        get(target, key) {
          if (key === "sync" || key === "writeFile")
            return async (...values: unknown[]) => {
              const stage = `${temporary ? "temporary" : directory ? "directory" : "lock"}-${String(key)}`;
              fault.events.push(stage);
              if (fault.stage === stage) throw Error("Injected persistence failure");
              return Reflect.apply(Reflect.get(target, key), target, values);
            };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  };
});

import { withDiscussionReplayCheckpoint as withStore } from "../apps/web/scripts/discussion-replay-storage";

const from = "2026-10-12T00:00:00.000000Z",
  until = "2026-10-12T01:00:00.000000Z";
const initial = { version: 1 as const, from, until, cursor: null, completed: false };
const progress = {
  ...initial,
  pending: {
    id: "comment",
    createdAt: until,
    contentId: "publication",
    audienceCursor: { id: "follow_50", createdAt: from },
  },
};
let directory: string, path: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "nexus-discussion-checkpoint-"));
  path = join(directory, "replay.json");
  fault.stage = "";
  fault.events = [];
});
afterEach(async () => {
  fault.stage = "";
  await rm(directory, { recursive: true, force: true });
});

it("persists private microsecond page progress, syncs replacement order and reloads on restart", async () => {
  await withStore(path, from, until, async ({ initial: saved, save }) => {
    expect(saved).toEqual(initial);
    const lock = JSON.parse(await readFile(`${path}.lock`, "utf8"));
    expect(lock).toMatchObject({ version: 1, pid: process.pid, from, until });
    expect((await stat(`${path}.lock`)).mode & 0o777).toBe(0o600);
    await save(progress);
  });
  expect(fault.events).toEqual([
    "lock-writeFile",
    "lock-sync",
    "temporary-writeFile",
    "temporary-sync",
    "rename",
    "directory-sync",
  ]);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  expect(await readdir(directory)).toEqual(["replay.json"]);
  await withStore(path, from, until, async ({ initial: saved }) => expect(saved).toEqual(progress));
  await writeFile(path, JSON.stringify(initial));
  await withStore(path, from, until, async ({ initial: saved }) => expect(saved).toEqual(initial));
});

it("blocks overlapping workers, including directory aliases, and releases the owned lock on failure", async () => {
  const alias = join(directory, "alias");
  await symlink(directory, alias);
  await expect(
    withStore(path, from, until, async () => {
      const callback = vi.fn();
      await expect(
        withStore(join(alias, "replay.json"), from, until, callback),
      ).rejects.toMatchObject({ code: "EEXIST" });
      expect(callback).not.toHaveBeenCalled();
      expect(await stat(`${path}.lock`)).toBeDefined();
      throw Error("Stopped active worker");
    }),
  ).rejects.toThrow("Stopped active worker");
  await expect(stat(`${path}.lock`)).rejects.toMatchObject({ code: "ENOENT" });
  await withStore(path, from, until, async ({ save }) => save(initial));
});

it.each(["", "{", "[]", "x".repeat(4097), JSON.stringify({ ...initial, from: until })])(
  "rejects corrupted, oversized or foreign windows without running delivery %#",
  async (body) => {
    await writeFile(path, body);
    const callback = vi.fn();
    await expect(withStore(path, from, until, callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
    expect(await readFile(path, "utf8")).toBe(body);
    expect(await readdir(directory)).toEqual(["replay.json"]);
  },
);

it("rejects checkpoint symlinks without overwriting their target", async () => {
  const target = join(directory, "original.json");
  await writeFile(target, JSON.stringify(progress));
  await symlink(target, path);
  await expect(withStore(path, from, until, vi.fn())).rejects.toThrow();
  expect(JSON.parse(await readFile(target, "utf8"))).toEqual(progress);
  await expect(stat(`${path}.lock`)).rejects.toMatchObject({ code: "ENOENT" });
});

it("preserves a pre-existing lock and validates windows before creating any files", async () => {
  await writeFile(`${path}.lock`, "prior worker");
  await expect(withStore(path, from, until, vi.fn())).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readFile(`${path}.lock`, "utf8")).toBe("prior worker");
  await rm(`${path}.lock`);
  await expect(withStore(path, until, from, vi.fn())).rejects.toThrow();
  expect(await readdir(directory)).toEqual([]);
});

it.each(["temporary-writeFile", "temporary-sync", "rename"])(
  "keeps the prior checkpoint and cleans up files when %s fails",
  async (stage) => {
    await writeFile(path, JSON.stringify(initial));
    fault.stage = stage;
    await expect(withStore(path, from, until, async ({ save }) => save(progress))).rejects.toThrow(
      "Injected",
    );
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(initial);
    expect(await readdir(directory)).toEqual(["replay.json"]);
    fault.stage = "";
    await withStore(path, from, until, async ({ save }) => save(progress));
  },
);

it("does not acknowledge a directory sync failure; a restart reads the complete replacement", async () => {
  await writeFile(path, JSON.stringify(initial));
  fault.stage = "directory-sync";
  const acknowledged = vi.fn();
  await expect(
    withStore(path, from, until, async ({ save }) => {
      await save(progress);
      acknowledged();
    }),
  ).rejects.toThrow("Injected");
  expect(acknowledged).not.toHaveBeenCalled();
  expect(await readdir(directory)).toEqual(["replay.json"]);
  fault.stage = "";
  await withStore(path, from, until, async ({ initial: saved }) => expect(saved).toEqual(progress));
});

it("rejects invalid progress before replacing the last valid file", async () => {
  await writeFile(path, JSON.stringify(progress));
  await expect(
    withStore(path, from, until, async ({ save }) => {
      await save({ ...progress, completed: true });
    }),
  ).rejects.toThrow();
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual(progress);
});

it("resumes a durable audience cursor and repeats only an uncheckpointed page after write failure", async () => {
  const row = { id: "comment", contentId: "publication", createdAt: until };
  const deliver = vi
    .fn()
    .mockResolvedValueOnce({ failed: 0, nextCursor: progress.pending.audienceCursor });
  const page = async () => [row];
  await withStore(path, from, until, async ({ initial: checkpoint, save }) => {
    await save(checkpoint);
    await replayDiscussionNotifications(checkpoint, { page, deliver, save }, 1);
  });
  deliver.mockResolvedValue({ failed: 0 });
  fault.stage = "temporary-sync";
  await expect(
    withStore(path, from, until, async ({ initial: checkpoint, save }) => {
      await replayDiscussionNotifications(checkpoint, { page, deliver, save }, 1);
    }),
  ).rejects.toThrow("Injected");
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual(progress);
  fault.stage = "";
  await withStore(path, from, until, async ({ initial: checkpoint, save }) => {
    const result = await replayDiscussionNotifications(checkpoint, { page, deliver, save }, 1);
    expect(result.checkpoint).toMatchObject({ cursor: { id: "comment" }, pending: undefined });
  });
  expect(deliver.mock.calls).toEqual([
    ["publication", "comment"],
    ["publication", "comment", progress.pending.audienceCursor],
    ["publication", "comment", progress.pending.audienceCursor],
  ]);
});
