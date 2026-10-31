#!/usr/bin/env node
import process from "node:process";
import { evaluateLegalSurfaces } from "./legal-surfaces-lib.mjs";

const result = evaluateLegalSurfaces(process.cwd());
if (result.status !== "passed") {
  process.stderr.write(`legal-surfaces: ${result.reason}\n`);
  process.exitCode = 1;
  process.exit();
}

process.stdout.write(
  `legal-surfaces: passed routes=${result.present.join(",")} (product surfaces only; not counsel approval)\n`,
);
