import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("Vitest config uses Vite 8-native dirname and Oxc JSX runtime", () => {
  const config = read("vitest.config.ts");
  assert.match(config, /import\.meta\.dirname/u);
  assert.match(config, /oxc:\s*\{\s*jsx:\s*\{\s*runtime:\s*"automatic"/u);
  assert.doesNotMatch(config, /^\s*esbuild:\s*\{/mu);
  assert.doesNotMatch(config, /classifyTests\(__dirname/u);
});
