import { randomUUID } from "node:crypto";
import {
  auditEvents,
  resourceDownloadAuthorizationRepository as authorization,
  buildRepository,
  db,
  productRepository,
  resourceDeliveriesRepository as receipts,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { inArray, or } from "drizzle-orm";
import { afterEach } from "vitest";
import {
  entitlements,
  licenses,
  products,
  reports,
  supportCases,
  users,
  verificationRequests,
} from "../../site/packages/db/src/schema";

export { db };

const auditIds = [
  "aud_secsub_login",
  "aud_secsub_removed",
  "aud_secsub_other",
  "aud_secsub_foreign",
  "aud_secsub_owner",
  "aud_secsub_self_remove",
  "aud_secsub_lic_suspend",
  "aud_secsub_lic_expired",
  "aud_secsub_lic_other",
  "aud_secsub_case_reviewed",
  "aud_secsub_case_other",
  "aud_secsub_ver_approved",
  "aud_secsub_ver_rejected",
  "aud_secsub_ver_other",
  "aud_server_verification_ver_secsub_srv",
  "aud_server_verification_ver_secsub_srv_other",
  "aud_secsub_support_status",
  "aud_secsub_support_message",
  "aud_secsub_support_other",
  "aud_secsub_support_other_message",
  "aud_secsub_report_resolve",
  "aud_secsub_report_dismiss",
  "aud_secsub_report_other",
  "aud_secsub_report_self",
  "aud_secsub_build_notify",
  "aud_secsub_build_silent",
  "aud_secsub_build_other",
  "aud_secsub_build_restore",
  "aud_secsub_build_started_only",
];

/** Stable fixture ids for security-activity subject lookup suites. */
export const fixture = {
  userId: "usr_secsub_member",
  otherUserId: "usr_secsub_other_owner",
  productId: "prd_secsub_lic",
  otherProductId: "prd_secsub_lic_other",
  quarantineProductId: "prd_secsub_qi",
  otherQuarantineProductId: "prd_secsub_qi_other",
  quarantineBuildId: "bld_secsub_qi",
  otherQuarantineBuildId: "bld_secsub_qi_other",
  licenseId: "lic_secsub_owned",
  otherLicenseId: "lic_secsub_other",
  caseId: "case_secsub_owned",
  otherCaseId: "case_secsub_other",
  verificationId: "ver_secsub_owned",
  otherVerificationId: "ver_secsub_other",
  serverVerificationId: "ver_secsub_srv",
  otherServerVerificationId: "ver_secsub_srv_other",
  serverId: "srv_secsub_owned",
  otherServerId: "srv_secsub_other",
  reportId: "rpt_secsub_owned",
  otherReportId: "rpt_secsub_other",
  quarantineEntitlementId: "ent_secsub_qi",
  otherQuarantineEntitlementId: "ent_secsub_qi_other",
};

/** Delete disposable subject-lookup rows left by prior tests. */
export async function clearFixtures() {
  await db
    .delete(auditEvents)
    .where(
      or(
        inArray(auditEvents.id, auditIds),
        inArray(auditEvents.actorId, [fixture.userId, fixture.otherUserId]),
        inArray(auditEvents.targetId, [
          fixture.quarantineBuildId,
          fixture.otherQuarantineBuildId,
          fixture.quarantineProductId,
          fixture.otherQuarantineProductId,
        ]),
      ),
    );
  await db
    .delete(verificationRequests)
    .where(
      inArray(verificationRequests.id, [
        fixture.verificationId,
        fixture.otherVerificationId,
        fixture.serverVerificationId,
        fixture.otherServerVerificationId,
      ]),
    );
  await db
    .delete(supportCases)
    .where(inArray(supportCases.id, [fixture.caseId, fixture.otherCaseId]));
  await db.delete(reports).where(inArray(reports.id, [fixture.reportId, fixture.otherReportId]));
  await db
    .delete(entitlements)
    .where(
      inArray(entitlements.id, [
        fixture.quarantineEntitlementId,
        fixture.otherQuarantineEntitlementId,
      ]),
    );
  await db
    .delete(licenses)
    .where(inArray(licenses.id, [fixture.licenseId, fixture.otherLicenseId]));
  await db
    .delete(products)
    .where(
      inArray(products.id, [
        fixture.productId,
        fixture.otherProductId,
        fixture.quarantineProductId,
        fixture.otherQuarantineProductId,
      ]),
    );
  await db.delete(users).where(inArray(users.id, [fixture.userId, fixture.otherUserId]));
}

/** Register shared afterEach cleanup for security-activity subject suites. */
export function setupSecurityActivitySubject() {
  afterEach(async () => {
    await clearFixtures();
  });
}

/** Create the subject member and a foreign owner used by ownership-scoped cases. */
export async function seedSubjectUsers(otherRole: "user" | "developer" = "user") {
  await userRepository.create({
    id: fixture.userId,
    email: `${fixture.userId}@example.invalid`,
    username: fixture.userId,
    displayName: "Subject member",
    role: "user",
  });
  await userRepository.create({
    id: fixture.otherUserId,
    email: `${fixture.otherUserId}@example.invalid`,
    username: fixture.otherUserId,
    displayName: "Other owner",
    role: otherRole,
  });
}

async function ensureDownloadSession(userId: string) {
  const token = `tok_dlv_${userId}`;
  try {
    await sessionRepository.create({
      id: `ses_dlv_${userId}`,
      userId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  } catch {
    // Reused across served/started helpers in the same fixture.
  }
  return token;
}

/** Record a completed download receipt for quarantine subject coverage. */
export async function servedReceipt(
  userId: string,
  productId: string,
  buildId: string,
  entitlementId: string,
) {
  await db.insert(entitlements).values({
    id: entitlementId,
    subjectType: "user",
    subjectId: userId,
    permission: "product.download",
    resourceId: productId,
  });
  const expected = await buildRepository.findById(buildId);
  if (!expected) throw new Error("Missing quarantine fixture build");
  const receiptId = `dlv_secsub_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const currentToken = await ensureDownloadSession(userId);
  await authorization.authorize({
    actorId: userId,
    currentToken,
    expected,
    pinned: true,
    receiptId,
    auditId: `aud_dlv_start_${receiptId}`,
  });
  await receipts.finish({
    userId,
    receiptId,
    auditId: `aud_dlv_finish_${receiptId}`,
    result: { status: "served", bytesSent: expected.fileSizeBytes, errorCode: null },
  });
  return receiptId;
}

/** Authorize a download that never finishes, so quarantine should stay silent. */
export async function startedReceipt(
  userId: string,
  productId: string,
  buildId: string,
  entitlementId: string,
) {
  await db.insert(entitlements).values({
    id: entitlementId,
    subjectType: "user",
    subjectId: userId,
    permission: "product.download",
    resourceId: productId,
  });
  const expected = await buildRepository.findById(buildId);
  if (!expected) throw new Error("Missing quarantine fixture build");
  const receiptId = `dlv_secsub_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const currentToken = await ensureDownloadSession(userId);
  await authorization.authorize({
    actorId: userId,
    currentToken,
    expected,
    pinned: true,
    receiptId,
    auditId: `aud_dlv_start_${receiptId}`,
  });
  return receiptId;
}

/** Create a published product + clean build used by quarantine subject cases. */
export async function quarantineProduct(productId: string, buildId: string, authorId: string) {
  await productRepository.create({
    id: productId,
    title: "Quarantine subject fixture",
    slug: productId,
    description: "SEC-005 quarantine subject fixture",
    type: "script",
    status: "published",
    authorId,
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: [],
    currentVersion: "1.0.0",
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 0,
    isFeatured: false,
    screenshots: [],
    compatibility: { dependencies: [] },
  });
  await buildRepository.create({
    id: buildId,
    productId,
    version: "1.0.0",
    releaseNotes: "fixture",
    status: "published",
    storageKey: `fixtures/${buildId}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
    fileName: "1.0.0.zip",
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "test-scanner",
    scannedAt: new Date(),
    isSigned: false,
  });
}
