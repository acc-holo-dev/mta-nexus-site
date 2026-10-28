import assert from "node:assert/strict";
import { test } from "node:test";
import { installBrowserTools } from "../browser-toolchain.mjs";

test("rejects unknown profiles and relative destinations before invoking npm", () => {
  const run = () => {
    throw new Error("npm should not run");
  };
  assert.throws(() => installBrowserTools("unexpected", "/tmp/tools", run), /profile/);
  assert.throws(() => installBrowserTools("basic", "relative", run), /absolute/);
});

test("preserves the installer's exit status and never invokes a shell for the destination", () => {
  const directory = "/tmp/tools with spaces $(invalid-command)";
  const calls = [];
  const status = installBrowserTools("a11y", directory, (...args) => {
    calls.push(args);
    return { status: 42 };
  });
  assert.equal(status, 42);
  const [command, args, options] = calls[0];
  assert.equal(command, "npm");
  assert.equal(args[args.indexOf("--prefix") + 1], directory);
  assert.notEqual(options.shell, true);
});

test("spawn failure or termination cannot produce a successful installation", () => {
  assert.equal(
    installBrowserTools("basic", "/tmp/tools", () => ({ status: null })),
    1,
  );
  assert.throws(
    () =>
      installBrowserTools("agent", "/tmp/tools", () => ({ error: new Error("npm unavailable") })),
    /npm unavailable/,
  );
});
