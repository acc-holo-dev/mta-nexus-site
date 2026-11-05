import { randomUUID as sessionUUID } from "node:crypto";
import {
  supportCaseRepository,
  sessionRepository as supportSessions,
  userRepository,
} from "@nexus/db";
import type { SupportCaseCategory } from "@nexus/domain";

export { supportCaseRepository, userRepository };

/** Unique suffix for disposable support-case repository fixtures. */
export function fixtureSuffix(label = "support") {
  return `${label}_${Date.now().toString(36)}_${process.pid}`;
}

/** Create a disposable user for support-case repository suites. */
export async function createSupportUser(input: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role?: string;
}) {
  await userRepository.create({
    role: "user",
    ...input,
  });
}

/** Open a support case with an initial requester message and create audit. */
export async function openSupportCase(input: {
  caseId: string;
  requesterId: string;
  category: SupportCaseCategory;
  subject: string;
  messageId: string;
  messageBody: string;
  auditId: string;
}) {
  await supportCaseRepository.createWithInitialMessage(
    {
      id: input.caseId,
      requesterId: input.requesterId,
      category: input.category,
      subject: input.subject,
      status: "open",
    },
    {
      id: input.messageId,
      caseId: input.caseId,
      authorId: input.requesterId,
      authorRole: "requester",
      body: input.messageBody,
    },
    {
      id: input.auditId,
      actorId: input.requesterId,
      actorType: "user",
      action: "support.case.created",
      targetId: input.caseId,
      targetType: "support_case",
    },
  );
}

/** Issue a fresh initiating session token for staff status mutations. */
export async function initiatingToken(userId: string) {
  const token = sessionUUID();
  await supportSessions.create({
    id: `ses_${sessionUUID()}`,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
}
