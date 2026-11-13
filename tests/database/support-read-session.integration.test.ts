import { randomUUID } from "node:crypto";
import {
  db,
  sessionRepository,
  supportCaseRepository,
  supportMessageDiscoveryRepository,
  supportActivityRepository,
  userRepository,
} from "@nexus/db";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { supportCaseMessages, supportCases, users } from "../../site/packages/db/src/schema";

it("checks the initiating session in every private support read snapshot", async () => {
  const key = randomUUID().replaceAll("-", ""),
    actorId = `usr_${key}`,
    caseId = `sup_${key.slice(0, 24)}`,
    token = `tok_${key}`;
  await userRepository.create({
    id: actorId,
    email: `${key}@example.invalid`,
    username: `s_${key}`,
    displayName: "Support reader",
    role: "moderator",
  });
  await sessionRepository.create({
    id: `ses_${key}`,
    userId: actorId,
    token,
    expiresAt: new Date(Date.now() + 60000),
  });
  await db.insert(supportCases).values({
    id: caseId,
    requesterId: actorId,
    subject: "Private subject",
    category: "account",
    status: "open",
  });
  await db.insert(supportCaseMessages).values({
    id: `spm_${key.slice(0, 24)}`,
    caseId,
    authorId: actorId,
    authorRole: "requester",
    body: "Private message",
  });
  const reads = () => [
    () => supportCaseRepository.pageByRequester(actorId, 1, 25, {}, token),
    () => supportCaseRepository.pageStaff(1, 25, {}, actorId, token),
    () => supportCaseRepository.authorizedThread(caseId, actorId, 1, token),
    () =>
      supportMessageDiscoveryRepository.page(
        caseId,
        actorId,
        { group: "all", query: "" },
        false,
        token,
      ),
    () => supportActivityRepository.history(caseId, actorId, undefined, token),
  ];
  try {
    for (const read of reads()) await expect(read()).resolves.toBeDefined();
    await sessionRepository.delete(token);
    for (const read of reads())
      await expect(read()).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
    await sessionRepository.create({
      id: `ses_exp_${key}`,
      userId: actorId,
      token,
      expiresAt: new Date("2000-01-01"),
    });
    for (const read of reads())
      await expect(read()).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
  } finally {
    await db.delete(supportCases).where(eq(supportCases.id, caseId));
    await db.delete(users).where(eq(users.id, actorId));
  }
});
