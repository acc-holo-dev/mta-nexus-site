import { readWebPushWorkerHealthSnapshot } from "./web-push-worker-health-state.mjs";

try {
  const snapshot = await readWebPushWorkerHealthSnapshot();
  process.stdout.write(
    `${JSON.stringify({
      status: snapshot.queueAlert,
      reasons: snapshot.queueAlertReasons,
      configured: snapshot.configured,
      heartbeatAt: snapshot.heartbeatAt,
      progressAt: snapshot.progressAt,
      progressStaleAfterMs: snapshot.progressStaleAfterMs,
      queuePending: snapshot.queuePending,
      queueDue: snapshot.queueDue,
      queueLeased: snapshot.queueLeased,
      queueCapacity: snapshot.queueCapacity,
      queueOldestAgeSeconds: snapshot.queueOldestAgeSeconds,
      reportPending: snapshot.reportPending,
      reportFailed: snapshot.reportFailed,
      reportOldestAgeSeconds: snapshot.reportOldestAgeSeconds,
      supportPending: snapshot.supportPending,
      supportFailed: snapshot.supportFailed,
      supportOldestAgeSeconds: snapshot.supportOldestAgeSeconds,
      verificationPending: snapshot.verificationPending,
      verificationFailed: snapshot.verificationFailed,
      verificationOldestAgeSeconds: snapshot.verificationOldestAgeSeconds,
      discussionPending: snapshot.discussionPending,
      discussionFailed: snapshot.discussionFailed,
      discussionOldestAgeSeconds: snapshot.discussionOldestAgeSeconds,
      publicationPending: snapshot.publicationPending,
      publicationFailed: snapshot.publicationFailed,
      publicationOldestAgeSeconds: snapshot.publicationOldestAgeSeconds,
      admissionPending: snapshot.admissionPending,
      admissionFailed: snapshot.admissionFailed,
      admissionOldestAgeSeconds: snapshot.admissionOldestAgeSeconds,
      thresholds: snapshot.queueAlertThresholds,
    })}\n`,
  );
  if (snapshot.queueAlert === "alert") process.exitCode = 2;
} catch {
  process.stderr.write('{"status":"invalid"}\n');
  process.exitCode = 1;
}
