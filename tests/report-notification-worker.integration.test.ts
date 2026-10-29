import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import { db } from "../packages/db/src/client";
import { reportRepository } from "../packages/db/src/repositories/reports";
import { userRepository } from "../packages/db/src/repositories/users";
import {
  auditEvents,
  notifications,
  reportNotificationDeliveries,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [];
afterEach(async () => {
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(users).where(inArray(users.id, actors));
  }
  actors.length = 0;
});

it("the real worker delivers moderator inbox without VAPID or a surviving HTTP callback", async () => {
  const suffix = randomUUID().replaceAll("-", "");
  for (const role of ["user", "moderator"] as const) {
    const actorId = `usr_worker_report_${role}_${suffix}`;
    await userRepository.create({
      id: actorId,
      username: actorId,
      email: `${actorId}@nexus.test`,
      displayName: "Worker fixture",
      role,
    });
    actors.push(actorId);
  }
  await db
    .update(users)
    .set({ createdAt: new Date("2000-01-01T00:00:00.000Z") })
    .where(inArray(users.id, actors));
  const reportId = `rpt_worker_${suffix}`;
  await reportRepository.createWithAudit(
    {
      id: reportId,
      reporterId: actors[0],
      targetType: "user",
      targetId: actors[1],
      type: "abuse",
      reason: "PRIVATE_REPORT_REASON",
      evidenceUrls: [],
      status: "open",
    },
    {
      id: `aud_worker_${suffix}`,
      actorId: actors[0],
      actorType: "user",
      action: "report.created",
      targetType: "report",
      targetId: reportId,
      details: {},
    },
  );
  // Give this fixture an isolated audience and priority over any retained
  // sources from other suites sharing the disposable database.
  await db
    .update(reportNotificationDeliveries)
    .set({
      createdAt: new Date("2001-01-01T00:00:00.000Z"),
      availableAt: new Date(0),
    })
    .where(eq(reportNotificationDeliveries.reportId, reportId));
  const root = await mkdtemp(path.join(tmpdir(), "nexus-report-worker-"));
  try {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "packages/db/scripts/run-web-push-dispatcher.ts", "--once"],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        encoding: "utf8",
        timeout: 30_000,
        env: {
          ...process.env,
          WEB_PUSH_VAPID_PUBLIC_KEY: "",
          WEB_PUSH_VAPID_PRIVATE_KEY: "",
          WEB_PUSH_VAPID_SUBJECT: "",
          NEXUS_WEB_PUSH_HEALTH_FILE: path.join(root, "health.json"),
        },
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('"status":"report-delivery"');
    expect(result.stdout).toContain('"configured":false');
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_REPORT_REASON");
    const inbox = await db
      .select()
      .from(notifications)
      .where(
        eq(
          notifications.id,
          `ntf_report_created_${createHash("sha256")
            .update(JSON.stringify([reportId, actors[1]]))
            .digest("hex")}`,
        ),
      );
    expect(inbox).toEqual([expect.objectContaining({ category: "security", link: "/admin" })]);
    const [job] = await db
      .select()
      .from(reportNotificationDeliveries)
      .where(eq(reportNotificationDeliveries.reportId, reportId));
    expect(job.completedAt).toBeInstanceOf(Date);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 40_000);
