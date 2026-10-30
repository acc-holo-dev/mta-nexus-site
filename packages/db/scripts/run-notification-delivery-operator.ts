import {
  assertResetAcknowledgement,
  parseNotificationDeliveryOperatorArgs,
  usageText,
} from "./notification-delivery-operator-contract.mjs";

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((token) => token !== "--");
  const parsed = parseNotificationDeliveryOperatorArgs(argv);
  if (parsed.command === "help") {
    process.stdout.write(usageText());
    return;
  }

  // Connect only after CLI options and reset acknowledgement are validated.
  if (parsed.command === "reset") assertResetAcknowledgement(process.env);

  const [
    { listExhaustedNotificationDeliveries, resetExhaustedNotificationDelivery },
    { closeDatabaseConnection },
  ] = await Promise.all([
    import("../src/repositories/notification-delivery-operator"),
    import("../src/client"),
  ]);

  try {
    if (parsed.command === "list") {
      const summaries = await listExhaustedNotificationDeliveries({
        channel: parsed.channel?.id ?? null,
        limit: parsed.limit,
      });
      process.stdout.write(`${JSON.stringify({ summaries }, null, 2)}\n`);
      const failed = summaries.reduce((total, item) => total + item.failed, 0);
      if (failed > 0) process.exitCode = 2;
      return;
    }

    const result = await resetExhaustedNotificationDelivery(
      parsed.channel.id as
        | "report"
        | "support"
        | "verification"
        | "discussion"
        | "publication"
        | "admission",
      parsed.id,
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.reset) {
      process.stderr.write(
        "No exhausted incomplete job matched that channel/id (or admission exceeded 24h).\n",
      );
      process.exitCode = 1;
    }
  } finally {
    await closeDatabaseConnection();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Notification delivery operator failed (${error instanceof Error ? error.message : "UnknownError"})\n`,
  );
  process.exitCode = 1;
});
