#!/usr/bin/env node
// Runs as part of the root build step (see package.json) and writes
// server/version.json, which the server reads at startup and exposes via
// GET /api/version for the footer to display. The build number is the
// total git commit count on the branch being built — it increments by
// exactly 1 on every commit/deploy with no manual bookkeeping to forget.
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(cmd, fallback) {
  try {
    return execSync(cmd, { cwd: repoRoot, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
}

const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf-8"));
const buildNumber = git("git rev-list --count HEAD", "0");
const commit = git("git rev-parse --short HEAD", "unknown");

const version = {
  version: pkg.version,
  buildNumber: Number(buildNumber) || 0,
  commit,
  builtAt: new Date().toISOString(),
};

writeFileSync(path.join(repoRoot, "server", "version.json"), JSON.stringify(version, null, 2) + "\n");
console.log(`[version] v${version.version} build ${version.buildNumber} (${version.commit})`);
