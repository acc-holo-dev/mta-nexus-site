import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

// Isolate the browser adapter: these tests verify gate/report behavior, not axe's DOM engine.
const directory = await mkdtemp(join(tmpdir(), "nexus-axe-gate-"));
const modulePath = join(directory, "node_modules/@axe-core/playwright");
await mkdir(modulePath, { recursive: true });
await writeFile(join(directory, "package.json"), '{"type":"commonjs"}');
await writeFile(join(modulePath, "index.js"), `exports.AxeBuilder = class {
  constructor({page}) { this.page = page; }
  withTags(tags) { this.page.tags = tags; return this; }
  async analyze() { if (this.page.error) throw this.page.error; return this.page.results; }
};`);
const originalTools = process.env.NEXUS_BROWSER_TOOLS;
const originalReport = process.env.NEXUS_BROWSER_REPORT_DIR;
process.env.NEXUS_BROWSER_TOOLS = directory;
process.env.NEXUS_BROWSER_REPORT_DIR = directory;
const { assertAxeAccessibility } = await import("../axe-accessibility.mjs");
after(async () => {
  if (originalTools === undefined) delete process.env.NEXUS_BROWSER_TOOLS;
  else process.env.NEXUS_BROWSER_TOOLS = originalTools;
  if (originalReport === undefined) delete process.env.NEXUS_BROWSER_REPORT_DIR;
  else process.env.NEXUS_BROWSER_REPORT_DIR = originalReport;
  await rm(directory, { recursive: true, force: true });
});

function fixture(overrides = {}) {
  const attachments = [];
  return {
    page: { results: {
      testEngine: { name: "axe-core", version: "fixture" },
      violations: [], incomplete: [], passes: [{ id: "label" }], ...overrides,
    } },
    info: { attach: async (name, value) => attachments.push({ name, ...value }) },
    attachments,
  };
}
const rule = {
  id: "button-name", impact: "moderate", help: "Button needs a name", helpUrl: "https://example.invalid/rule",
  nodes: [{ target: ["#continue"], html: '<button value="PRIVATE-VALUE"></button>', failureSummary: "PRIVATE-VALUE" }],
};

test("every violation blocks acceptance after its diagnostic is saved", async () => {
  const f = fixture({ violations: [rule] });
  await assert.rejects(assertAxeAccessibility(f.page, f.info, "failed-form"), /WCAG violations/);
  assert.equal(f.attachments.length, 1);
  const saved = JSON.parse(await readFile(join(directory, "axe/axe-failed-form.json"), "utf8"));
  assert.equal(saved.violations[0].id, "button-name");
  assert.deepEqual(saved.violations[0].targets, [["#continue"]]);
  assert(!JSON.stringify(saved).includes("PRIVATE-VALUE"));
});

test("incomplete checks remain visible as review evidence without becoming a false violation", async () => {
  const f = fixture({ incomplete: [rule] });
  await assertAxeAccessibility(f.page, f.info, "review-form");
  const saved = JSON.parse(f.attachments[0].body);
  assert.deepEqual(saved.violations, []);
  assert.equal(saved.incomplete[0].id, "button-name");
  assert.equal(saved.passedRules, 1);
  assert(f.page.tags.includes("wcag22aa"));
});

test("engine failures propagate instead of producing an empty passing report", async () => {
  const f = fixture();
  f.page.error = new Error("synthetic engine failure");
  await assert.rejects(assertAxeAccessibility(f.page, f.info, "engine-failed"), /synthetic engine failure/);
  assert.deepEqual(f.attachments, []);
});
