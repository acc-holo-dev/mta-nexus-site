import { randomBytes, randomUUID } from "node:crypto";
import {
  db,
  supportMessageDiscoveryRepository as discovery,
  supportCaseMessages,
  supportCaseRepository,
  supportCases,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";

const actorIds: string[] = [],
  caseIds: string[] = [];
const base = { group: "all" as const, query: "" };
afterEach(async () => {
  if (caseIds.length) await db.delete(supportCases).where(inArray(supportCases.id, caseIds));
  if (actorIds.length) await db.delete(users).where(inArray(users.id, actorIds));
  actorIds.length = 0;
  caseIds.length = 0;
});
async function actor(role: "user" | "moderator" = "user") {
  const key = randomUUID().replaceAll("-", "");
  const value = await userRepository.create({
    id: `usr_support_search_${key}`,
    username: `support_search_${key}`,
    email: `${key}@nexus.test`,
    displayName: "Search fixture",
    role,
  });
  actorIds.push(value.id);
  return value;
}
async function supportCase(requesterId: string) {
  const id = `sup_${randomBytes(12).toString("hex")}`;
  caseIds.push(id);
  await db.insert(supportCases).values({
    id,
    requesterId,
    subject: "Private message discovery fixture",
    category: "account",
    status: "open",
    relatedType: "purchase",
    relatedId: "private-related-context",
  });
  return id;
}
async function clock() {
  return (
    await db.execute<{ time: string }>(
      sql`select to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as time`,
    )
  )[0].time;
}
async function message(
  caseId: string,
  authorId: string,
  body: string,
  authorRole: "requester" | "staff" = "requester",
  time?: string,
) {
  const id = `spm_${randomBytes(12).toString("hex")}`;
  await db.insert(supportCaseMessages).values({
    id,
    caseId,
    authorId,
    authorRole,
    body,
    ...(time ? { createdAt: sql`${time}::timestamptz` } : {}),
  });
  return id;
}
it("traverses tied messages once in both directions while retaining a cutoff across new replies", async () => {
  const owner = await actor(),
    id = await supportCase(owner.id),
    time = await clock();
  const ids = Array.from({ length: 45 }, () => `spm_${randomBytes(12).toString("hex")}`);
  await db.insert(supportCaseMessages).values(
    ids.map((idValue) => ({
      id: idValue,
      caseId: id,
      authorId: owner.id,
      authorRole: "requester" as const,
      body: "Tied message",
      createdAt: sql`${time}::timestamptz`,
    })),
  );
  const first = await discovery.page(id, owner.id, base);
  expect(first.items).toHaveLength(20);
  expect(first.items[0].createdAt).toBe(time);
  if (!first.olderCursor) throw Error("Missing older cursor");
  const second = await discovery.page(id, owner.id, { ...base, cursor: first.olderCursor });
  if (!second.olderCursor || !second.newerCursor) throw Error("Missing page cursors");
  const third = await discovery.page(id, owner.id, { ...base, cursor: second.olderCursor });
  expect(third.items).toHaveLength(5);
  expect(third.olderCursor).toBeNull();
  expect(new Set([...first.items, ...second.items, ...third.items].map((item) => item.id))).toEqual(
    new Set(ids),
  );
  const added = await message(id, owner.id, "New reply after snapshot");
  const back = await discovery.page(id, owner.id, { ...base, cursor: second.newerCursor });
  expect(back.items).toEqual(first.items);
  expect(back.until).toBe(first.until);
  expect(back.items.map((item) => item.id)).not.toContain(added);
  expect((await discovery.page(id, owner.id, base)).items.map((item) => item.id)).toContain(added);
});
it("opens exact message permalinks, filters literal wildcards and hides identities and related context", async () => {
  const owner = await actor(),
    staff = await actor("moderator"),
    id = await supportCase(owner.id);
  const selected = await message(id, staff.id, "literal 100%_\\ support reply", "staff");
  await message(id, owner.id, "100 percent other reply");
  const filtered = await discovery.page(id, owner.id, { group: "staff", query: "100%_\\" });
  expect(filtered.items.map((item) => item.id)).toEqual([selected]);
  const focused = await discovery.page(id, owner.id, { ...base, focus: selected });
  expect(focused.focus).toBe(selected);
  expect(focused.items.some((item) => item.id === selected)).toBe(true);
  expect(focused.newerCursor).not.toBeNull();
  expect(JSON.stringify(focused)).not.toMatch(
    /private-related-context|authorId|requesterId|relatedId/u,
  );
  expect(JSON.stringify(focused)).not.toContain(staff.id);
});
it("rechecks current staff grants for the explorer and existing reply thread", async () => {
  const owner = await actor(),
    staff = await actor("moderator"),
    id = await supportCase(owner.id);
  await message(id, owner.id, "Private message");
  expect((await discovery.page(id, staff.id, base, true)).items).toHaveLength(1);
  expect((await supportCaseRepository.authorizedThread(id, staff.id)).staff).toBe(true);
  await db.update(users).set({ role: "user" }).where(eq(users.id, staff.id));
  await expect(discovery.page(id, staff.id, base)).rejects.toMatchObject({ statusCode: 404 });
  await expect(supportCaseRepository.authorizedThread(id, staff.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect((await supportCaseRepository.authorizedThread(id, owner.id)).requester).toBe(true);
});
it("rejects foreign, deleted and changed-filter anchors and bounds legacy Unicode messages", async () => {
  const owner = await actor(),
    id = await supportCase(owner.id),
    other = await supportCase(owner.id);
  const ownMessage = await message(id, owner.id, "😀".repeat(3000)),
    foreign = await message(other, owner.id, "Private other case");
  const page = await discovery.page(id, owner.id, { ...base, focus: ownMessage });
  expect(page.items[0].body.length).toBe(4000);
  expect(page.items[0].truncated).toBe(true);
  await expect(discovery.page(id, owner.id, { ...base, focus: foreign })).rejects.toMatchObject({
    code: "SUPPORT_MESSAGE_NOT_FOUND",
  });
  const context = (await import("node:crypto"))
    .createHash("sha256")
    .update(JSON.stringify([1, "support-messages", owner.id, id, "all", "all", ""]))
    .digest("hex");
  const cursor = {
    version: 1 as const,
    context,
    id: ownMessage,
    direction: "older" as const,
    until: page.until,
  };
  await expect(
    discovery.page(id, owner.id, { group: "staff", query: "", cursor }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await db.delete(supportCaseMessages).where(eq(supportCaseMessages.id, ownMessage));
  await expect(discovery.page(id, owner.id, { ...base, cursor })).rejects.toMatchObject({
    code: "SUPPORT_MESSAGES_EXPIRED",
  });
});
