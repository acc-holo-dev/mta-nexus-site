#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { fetchBetaCandidateEvidence } from "./fetch-beta-candidate-evidence-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resolveSha(argvSha) {
  if (argvSha) return argvSha;
  if (process.env.NEXUS_BETA_CANDIDATE_SHA) return process.env.NEXUS_BETA_CANDIDATE_SHA;
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0 || result.error) {
    throw new Error("Unable to resolve HEAD SHA; pass an exact SHA argument.");
  }
  return result.stdout.trim();
}

try {
  const sha = resolveSha(process.argv[2]);
  const result = fetchBetaCandidateEvidence({ sha, root });
  process.stdout.write(
    `Fetched beta candidate evidence for ${result.sha}\n` +
      `run=${result.runId}${result.runUrl ? ` ${result.runUrl}` : ""}\n` +
      result.installed
        .map((item) => `${item.id}: ${item.localPath} <- ${item.artifactName}`)
        .join("\n") +
      "\n" +
      "Next: on a clean checkout of that SHA run `pnpm beta:candidate`.\n" +
      "This fetch never invents PASS; invalid retained JSON still blocks the candidate harness.\n",
  );
} catch (error) {
  process.stderr.write(`beta:fetch: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
