/**
 * Node ESM cannot resolve extensionless TypeScript directory imports
 * (`./i18n/index`, `./en`). Register before importing apps/web i18n trees
 * from plain `node` scripts (Playwright harnesses).
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith(".") || !context.parentURL?.startsWith("file:")) {
      return nextResolve(specifier, context);
    }
    if (extname(specifier)) {
      return nextResolve(specifier, context);
    }

    const parent = fileURLToPath(context.parentURL);
    const base = join(dirname(parent), specifier);
    for (const candidate of [
      `${base}.ts`,
      `${base}.tsx`,
      join(base, "index.ts"),
      join(base, "index.tsx"),
    ]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
