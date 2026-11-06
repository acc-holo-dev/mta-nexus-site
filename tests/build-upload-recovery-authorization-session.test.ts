import { describe, expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createBuildUploadRecoveryAuthorizationDbMock } = await import(
    "./helpers/build-upload-recovery-authorization-harness"
  );
  return createBuildUploadRecoveryAuthorizationDbMock();
});

import { submitForReview } from "../packages/db/src/repositories/builds-moderation";
import {
  buildUploadRecoveryAuthorizationAudit as audit,
  buildUploadRecoveryAuthorizationLiveRows as liveRows,
  buildUploadRecoveryAuthorizationPending as pending,
  buildUploadRecoveryAuthorizationState as submitState,
  buildUploadRecoveryAuthorizationToken as token,
  buildUploadRecoveryAuthorizationTokenHash as tokenHash,
  buildUploadRecoveryAuthorizationWrites as writes,
  installBuildUploadRecoveryAuthorizationHooks,
} from "./helpers/build-upload-recovery-authorization-harness";

describe("build upload final initiating-session gate", () => {
  installBuildUploadRecoveryAuthorizationHooks();

  it("locks product and actor before the initiating session, then writes the build", async () => {
    liveRows();
    const created = await submitForReview(pending, audit, token);
    expect(created).toMatchObject({ id: pending.id, status: "pending_review" });
    expect(submitState.queries[0].sql).toContain("for no key update");
    expect(submitState.queries[1].sql).toContain("for share");
    expect(submitState.queries[2].sql).toContain('"sessions"');
    expect(submitState.queries[2].sql).toContain("for update");
    expect(submitState.queries[2].params).toContain("author");
    expect(submitState.queries[2].params).toContain(tokenHash(token));
    expect(submitState.queries[2].params).not.toContain(token);
    expect(submitState.queries[3].sql).toMatch(/^insert into "builds" /u);
    expect(writes("builds")).toHaveLength(1);
    expect(writes("audit_events")).toHaveLength(1);
  });

  it.each([
    { label: "missing", session: [] as unknown[][] },
    { label: "expired", session: [["ses_author", "2000-01-01T00:00:00.000Z"]] as unknown[][] },
  ])("refuses a $label initiating session without a new build or audit", async ({ session }) => {
    liveRows(session);
    await expect(submitForReview(pending, audit, token)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
    expect(writes("builds")).toHaveLength(0);
    expect(writes("products")).toHaveLength(0);
    expect(writes("audit_events")).toHaveLength(0);
  });

  it("does not accept another live session for the same actor", async () => {
    liveRows([]);
    await expect(submitForReview(pending, audit, "other-live-session")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
    expect(writes("builds")).toHaveLength(0);
    expect(submitState.queries[2].params).toContain(tokenHash("other-live-session"));
  });
});
