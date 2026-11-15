#!/usr/bin/env node
import { selectFocusedTests } from "./focused-test-selection.mjs";

try {
  selectFocusedTests(process.cwd(), process.argv.slice(2), { compose: true });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
