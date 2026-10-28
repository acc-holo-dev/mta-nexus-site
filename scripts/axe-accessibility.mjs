import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// Browser-only dependencies are installed in the isolated test tool directory.
assert(process.env.NEXUS_BROWSER_TOOLS, "The browser tool directory is required");
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { AxeBuilder } = require("@axe-core/playwright");
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function findings(rules) {
  return rules.map((rule) => ({
    id: rule.id,
    impact: rule.impact,
    help: rule.help,
    helpUrl: rule.helpUrl,
    targets: rule.nodes.map((node) => node.target),
  }));
}

/** Scan the rendered state, attach diagnostics, then fail on every WCAG violation. */
export async function assertAxeAccessibility(page, testInfo, label) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  // Do not retain HTML, form values or arbitrary page text in the JSON attachment.
  const report = {
    label,
    engine: results.testEngine,
    tags,
    violations: findings(results.violations),
    incomplete: findings(results.incomplete),
    passedRules: results.passes.length,
  };
  const name = `axe-${label.replace(/[^a-zA-Z0-9_-]/gu, "-")}`;
  const body = JSON.stringify(report, null, 2);
  assert(process.env.NEXUS_BROWSER_REPORT_DIR, "A browser report directory is required");
  const directory = join(resolve(process.env.NEXUS_BROWSER_REPORT_DIR), "axe");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${name}.json`), body);
  await testInfo.attach(name, {
    body,
    contentType: "application/json",
  });
  assert.deepEqual(report.violations, [], `${label}: automatically detectable WCAG violations`);
}
