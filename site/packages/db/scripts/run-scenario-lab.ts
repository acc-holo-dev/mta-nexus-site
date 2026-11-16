import {
  assertScenarioEnvironment,
  assertScenarioId,
  scenarioCatalog,
} from "./scenario-lab-contract.mjs";

function printCatalog() {
  process.stdout.write(
    `${scenarioCatalog.map((scenario) => `${scenario.id}\t${scenario.description}`).join("\n")}\n`,
  );
}

async function main() {
  const [, , command, rawScenario] = process.argv;

  if (command === "list") {
    printCatalog();
    return;
  }

  if (command !== "apply" && command !== "cleanup") {
    throw new Error("Usage: run-scenario-lab.ts <list|apply|cleanup> [scenario]");
  }

  // Guard before importing the database module. A refused invocation must not
  // initialize application config or a PostgreSQL client.
  assertScenarioEnvironment(process.env);
  const scenario = assertScenarioId(rawScenario);

  const { applyScenario, cleanupScenario } = await import("./scenario-lab-db.ts");
  const result =
    command === "apply" ? await applyScenario(scenario) : await cleanupScenario(scenario);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Scenario Lab failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
