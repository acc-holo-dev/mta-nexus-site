import { existsSync, realpathSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

/** Validate selections before starting tests or creating a disposable database. */
export function selectFocusedTests(root, args, { compose = false } = {}) {
  if (!args.length) throw new Error("Select at least one test file.");
  const realRoot = realpathSync(root);
  const selected = [];
  for (const arg of args) {
    const absolute = resolve(root, arg);
    const rel = relative(root, absolute).split(sep).join("/");
    if (
      arg.startsWith("-") ||
      !/(?:\.(test|spec)\.[cm]?[jt]sx?|\.node-test\.mjs)$/u.test(arg) ||
      !existsSync(absolute) ||
      !statSync(absolute).isFile() ||
      !realpathSync(absolute).startsWith(`${realRoot}${sep}`) ||
      (compose &&
        (!/^(?:site\/tests|site\/src)\//u.test(rel) ||
          !/^(?:site\/tests|site\/src)\//u.test(
            relative(realRoot, realpathSync(absolute)).split(sep).join("/"),
          )))
    ) {
      throw new Error(
        `Expected an existing test file ${compose ? "under site/tests or site/src" : "inside the repository"}: ${arg}`,
      );
    }
    selected.push(rel);
  }
  return [...new Set(selected)];
}
