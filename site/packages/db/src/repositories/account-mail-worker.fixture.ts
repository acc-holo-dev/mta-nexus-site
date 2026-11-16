// IPC-only synthetic CI fixture. Claims once, then the test kills this process.
// No transport, plaintext envelope, credentials or lease is printed to logs.
import { accountMailWorkerRepository } from "./account-mail-worker";

const send = process.send?.bind(process);
if (process.env.NODE_ENV !== "test" || !send || !process.env.DATABASE_URL) {
  process.exit(1);
}

const timeout = setTimeout(() => process.exit(1), 10_000);

try {
  const lease = await accountMailWorkerRepository.claim(process.argv[2] ?? "");
  await new Promise<void>((resolve, reject) => {
    send({ lease }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  // Keep the process alive after the lease has been handed off. The parent test
  // then sends SIGKILL to simulate an ungraceful worker stop after commit.
  await new Promise<void>((resolve) => process.once("disconnect", resolve));
} catch {
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  process.exit(process.exitCode ?? 0);
}
