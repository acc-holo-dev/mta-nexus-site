// IPC-only synthetic CI fixture. Claims once, then the test kills this process.
// No transport, plaintext envelope, credentials or lease is printed to logs.
import { accountMailWorkerRepository } from "./account-mail-worker";
if (process.env.NODE_ENV !== "test" || !process.send || !process.env.DATABASE_URL) process.exit(1);
const timeout = setTimeout(() => process.exit(1), 10_000);
try {
  const lease = await accountMailWorkerRepository.claim(process.argv[2] ?? "");
  process.send!({ lease });
  // Keep the process alive until the parent simulates an ungraceful worker stop.
  await new Promise<void>((resolve) => process.on("disconnect", resolve));
} catch { process.exitCode = 1; }
finally { clearTimeout(timeout); process.exit(process.exitCode ?? 0); }
