import { readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async () => {
  const { createDiscussionReplayStorageFsMock } = await import(
    "./helpers/discussion-replay-storage-harness"
  );
  return createDiscussionReplayStorageFsMock();
});

import { withDiscussionReplayCheckpoint } from "../apps/web/scripts/discussion-replay-storage";
import {
  discussionReplayStorageFault as fault,
  discussionReplayStorageFrom as from,
  discussionReplayStorageIdentity as identity,
  discussionReplayStorageInitial as initial,
  installDiscussionReplayStorageHooks,
  discussionReplayStoragePaths as paths,
  discussionReplayStorageProgress as progress,
  discussionReplayStorageStored as stored,
  discussionReplayStorageUntil as until,
} from "./helpers/discussion-replay-storage-harness";

installDiscussionReplayStorageHooks();

// Existing fixtures intentionally exercise operator-approved adoption of version 1.
const withStore = <T>(
  path: string,
  fromWindow: string,
  untilWindow: string,
  run: Parameters<typeof withDiscussionReplayCheckpoint<T>>[4],
) =>
  withDiscussionReplayCheckpoint(
    path,
    fromWindow,
    untilWindow,
    { identity, adoptLegacy: true },
    run,
  );

it("persists private microsecond page progress, syncs replacement order and reloads on restart", async () => {
  const { path, directory } = paths;
  await withStore(path, from, until, async ({ initial: saved, save }) => {
    expect(saved).toEqual(initial);
    const lock = JSON.parse(await readFile(`${path}.lock`, "utf8"));
    expect(lock).toMatchObject({
      version: 2,
      pid: process.pid,
      from,
      until,
      databaseIdentity: identity,
    });
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
  const { path, directory } = paths;
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
    const { path, directory } = paths;
    await writeFile(path, body);
    const callback = vi.fn();
    await expect(withStore(path, from, until, callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
    expect(await readFile(path, "utf8")).toBe(body);
    expect(await readdir(directory)).toEqual(["replay.json"]);
  },
);

it("rejects checkpoint symlinks without overwriting their target", async () => {
  const { path, directory } = paths;
  const target = join(directory, "original.json");
  await writeFile(target, JSON.stringify(progress));
  await symlink(target, path);
  await expect(withStore(path, from, until, vi.fn())).rejects.toThrow();
  expect(JSON.parse(await readFile(target, "utf8"))).toEqual(progress);
  await expect(stat(`${path}.lock`)).rejects.toMatchObject({ code: "ENOENT" });
});

it("preserves a pre-existing lock and validates windows before creating any files", async () => {
  const { path, directory } = paths;
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
    const { path, directory } = paths;
    await writeFile(path, JSON.stringify(initial));
    fault.stage = stage;
    await expect(withStore(path, from, until, async ({ save }) => save(progress))).rejects.toThrow(
      "Injected",
    );
    expect(await stored()).toEqual(initial);
    expect(await readdir(directory)).toEqual(["replay.json"]);
    fault.stage = "";
    await withStore(path, from, until, async ({ save }) => save(progress));
  },
);

it("does not acknowledge a directory sync failure; a restart reads the complete replacement", async () => {
  const { path, directory } = paths;
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
  const { path } = paths;
  await writeFile(path, JSON.stringify(progress));
  await expect(
    withStore(path, from, until, async ({ save }) => {
      await save({ ...progress, completed: true });
    }),
  ).rejects.toThrow();
  expect(await stored()).toEqual(progress);
});
