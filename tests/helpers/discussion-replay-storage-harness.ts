import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, vi } from "vitest";

/** Shared injected fs fault capture for discussion-replay-storage suites. */
export const discussionReplayStorageFault = { stage: "", events: [] as string[] };

/** Factory for `vi.mock("node:fs/promises", …)` from suite files under `tests/`. */
export async function createDiscussionReplayStorageFsMock() {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    rename: async (...args: Parameters<typeof actual.rename>) => {
      discussionReplayStorageFault.events.push("rename");
      if (discussionReplayStorageFault.stage === "rename") throw Error("Injected rename failure");
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
              discussionReplayStorageFault.events.push(stage);
              if (discussionReplayStorageFault.stage === stage)
                throw Error("Injected persistence failure");
              return Reflect.apply(Reflect.get(target, key), target, values);
            };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  };
}

export const discussionReplayStorageIdentity = "a".repeat(64);
export const discussionReplayStorageFrom = "2026-10-12T00:00:00.000000Z";
export const discussionReplayStorageUntil = "2026-10-12T01:00:00.000000Z";
export const discussionReplayStorageInitial = {
  version: 1 as const,
  from: discussionReplayStorageFrom,
  until: discussionReplayStorageUntil,
  cursor: null,
  completed: false,
};
export const discussionReplayStorageProgress = {
  ...discussionReplayStorageInitial,
  pending: {
    id: "comment",
    createdAt: discussionReplayStorageUntil,
    contentId: "publication",
    audienceCursor: {
      id: "follow_50",
      createdAt: discussionReplayStorageFrom,
    },
  },
};

export const discussionReplayStoragePaths = {
  directory: "",
  path: "",
};

export async function discussionReplayStorageStored() {
  const value = JSON.parse(await readFile(discussionReplayStoragePaths.path, "utf8"));
  return value.version === 2 ? value.checkpoint : value;
}

export function installDiscussionReplayStorageHooks() {
  beforeEach(async () => {
    discussionReplayStoragePaths.directory = await mkdtemp(
      join(tmpdir(), "nexus-discussion-checkpoint-"),
    );
    discussionReplayStoragePaths.path = join(discussionReplayStoragePaths.directory, "replay.json");
    discussionReplayStorageFault.stage = "";
    discussionReplayStorageFault.events = [];
  });
  afterEach(async () => {
    discussionReplayStorageFault.stage = "";
    await rm(discussionReplayStoragePaths.directory, { recursive: true, force: true });
  });
}
