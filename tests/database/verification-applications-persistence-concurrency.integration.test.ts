import { describe, expect, it } from "vitest";
import {
  amend,
  repo,
  request,
  staffSession,
  user,
  verificationRepository,
} from "../helpers/verification-applications-persistence-harness";

describe("verification applications persistence: concurrent amend and resolve races", () => {
  it("serializes two replacements of the same evidence version and a replacement racing with a moderator decision", async () => {
    const actorId = await user(),
      reviewerId = await user("moderator"),
      token = await staffSession(reviewerId),
      application = await request(actorId),
      before = await repo.application(actorId, application.id);
    const replacements = await Promise.allSettled([
      amend(actorId, application.id, before.revision),
      amend(actorId, application.id, before.revision),
    ]);
    expect(replacements.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(replacements.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "VERIFICATION_APPLICATION_CHANGED" },
    });
    const current = await repo.application(actorId, application.id),
      race = await Promise.allSettled([
        amend(actorId, application.id, current.revision),
        verificationRepository.resolveRequest({
          id: application.id,
          reviewerId,
          decision: "rejected",
          currentToken: token,
          expectedApplicationRevision: current.revision,
        }),
      ]);
    expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(race.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "VERIFICATION_APPLICATION_CHANGED" },
    });
  });
});
