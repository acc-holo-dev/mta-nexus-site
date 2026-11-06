import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { replayDiscussionNotifications } from "../apps/web/src/lib/services/discussion-notification-replay";

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

it("resumes a durable audience cursor and repeats only an uncheckpointed page after write failure", async () => {
  const { path } = paths;
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
  expect(await stored()).toEqual(progress);
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

it("binds new checkpoints and denies foreign database scopes even with legacy adoption", async () => {
  const { path } = paths;
  await withDiscussionReplayCheckpoint(path, from, until, { identity }, async ({ save }) =>
    save(progress),
  );
  const body = await readFile(path, "utf8");
  expect(JSON.parse(body)).toEqual({
    version: 2,
    databaseIdentity: identity,
    checkpoint: progress,
  });
  for (const adoptLegacy of [false, true]) {
    const run = vi.fn();
    await expect(
      withDiscussionReplayCheckpoint(
        path,
        from,
        until,
        {
          identity: "b".repeat(64),
          adoptLegacy,
        },
        run,
      ),
    ).rejects.toThrow("another database");
    expect(run).not.toHaveBeenCalled();
    expect(await readFile(path, "utf8")).toBe(body);
  }
});

it("requires deliberate legacy adoption, then preserves exact progress in the bound envelope", async () => {
  const { path } = paths;
  await writeFile(path, JSON.stringify(progress));
  const callback = vi.fn();
  await expect(
    withDiscussionReplayCheckpoint(path, from, until, { identity }, callback),
  ).rejects.toThrow("adoption");
  expect(callback).not.toHaveBeenCalled();
  expect(await stored()).toEqual(progress);
  await withStore(path, from, until, async ({ initial: saved, save }) => {
    expect(saved).toEqual(progress);
    await save(saved);
  });
  const value = JSON.parse(await readFile(path, "utf8"));
  expect(value).toEqual({ version: 2, databaseIdentity: identity, checkpoint: progress });
  await withDiscussionReplayCheckpoint(
    path,
    from,
    until,
    { identity },
    async ({ initial: saved }) => expect(saved).toEqual(progress),
  );
});

it.each([
  { version: 2, databaseIdentity: identity },
  { version: 2, checkpoint: initial },
  { version: 2, databaseIdentity: identity, checkpoint: { ...initial, from: until } },
  { version: 3, databaseIdentity: identity, checkpoint: initial },
])("rejects damaged bound envelopes without falling back to legacy %#", async (value) => {
  const { path } = paths;
  await writeFile(path, JSON.stringify(value));
  const run = vi.fn();
  await expect(withStore(path, from, until, run)).rejects.toThrow();
  expect(run).not.toHaveBeenCalled();
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual(value);
});

it("rejects concurrent saves and never regresses the durable audience cursor", async () => {
  const { path } = paths;
  await withDiscussionReplayCheckpoint(path, from, until, { identity }, async ({ save }) => {
    const active = save(progress);
    await expect(save(initial)).rejects.toThrow("Concurrent");
    await active;
    await expect(save(initial)).rejects.toThrow("regress");
    expect(await stored()).toEqual(progress);
    await save({
      ...progress,
      pending: {
        ...progress.pending,
        audienceCursor: { ...progress.pending.audienceCursor, id: "follow_51" },
      },
    });
    await expect(save(progress)).rejects.toThrow("regress");
  });
  expect((await stored()).pending.audienceCursor.id).toBe("follow_51");
});

it("rejects invalid identity before creating files", async () => {
  const { path, directory } = paths;
  await expect(
    withDiscussionReplayCheckpoint(
      path,
      from,
      until,
      { identity: "private-connection-url" },
      vi.fn(),
    ),
  ).rejects.toThrow("identity");
  expect(await readdir(directory)).toEqual([]);
});

it("binds repair checkpoints to their delivery policy and refuses prior inbox progress", async () => {
  const { path } = paths;
  await withDiscussionReplayCheckpoint(path, from, until, { identity }, async ({ save }) =>
    save(progress),
  );
  await expect(
    withDiscussionReplayCheckpoint(
      path,
      from,
      until,
      { identity, deliveryPolicy: "inbox-and-pending-push" },
      vi.fn(),
    ),
  ).rejects.toThrow("policy");
  await rm(path);
  await withDiscussionReplayCheckpoint(
    path,
    from,
    until,
    { identity, deliveryPolicy: "inbox-and-pending-push" },
    async ({ save }) => save(initial),
  );
  expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
    deliveryPolicy: "inbox-and-pending-push",
  });
  await expect(
    withDiscussionReplayCheckpoint(path, from, until, { identity }, vi.fn()),
  ).rejects.toThrow("policy");
  await withDiscussionReplayCheckpoint(
    path,
    from,
    until,
    { identity, deliveryPolicy: "inbox-and-pending-push" },
    async ({ initial: saved }) => expect(saved).toEqual(initial),
  );
  await writeFile(path, JSON.stringify(initial));
  await expect(
    withDiscussionReplayCheckpoint(
      path,
      from,
      until,
      { identity, deliveryPolicy: "inbox-and-pending-push", adoptLegacy: true },
      vi.fn(),
    ),
  ).rejects.toThrow("inbox-only");
});
