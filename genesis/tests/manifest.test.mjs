import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const genesisRoot = path.resolve(testDir, "..");
const dataRoot = path.join(genesisRoot, "data");

execFileSync(
  process.execPath,
  [path.join(genesisRoot, "tools", "build-genesis-manifest.mjs"), "--check"],
  { stdio: "inherit" }
);

const read = (name) => JSON.parse(fs.readFileSync(path.join(dataRoot, name), "utf8"));
const hash = (name) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(dataRoot, name)))
    .digest("hex");

const artifacts = read("artifacts.json");
const repositories = read("repositories.json");
const lineage = read("lineage.json");
const eras = read("eras.json");
const milestones = read("milestones.json");
const manifest = read("manifest.json");

assert.equal(artifacts.artifacts.length, 8);
assert.ok(artifacts.artifacts.every((artifact) => artifact.record_sha256.length === 64));
assert.ok(
  artifacts.artifacts
    .filter((artifact) => artifact.historical_framing)
    .every((artifact) => /not|historical|implementation/i.test(artifact.curation_note))
);
assert.equal(repositories.repositories.length, 20);
assert.equal(repositories.summary.forks, 6);
assert.equal(repositories.summary.first_party, 6);
assert.ok(
  repositories.repositories
    .filter((repository) => repository.fork)
    .every((repository) => repository.classification === "FORK")
);
assert.ok(
  lineage.edges.every(
    (edge) =>
      edge.code_ancestry_claimed === false &&
      repositories.repositories.find((repository) => repository.id === edge.from)?.classification !== "FORK" &&
      repositories.repositories.find((repository) => repository.id === edge.to)?.classification !== "FORK"
  )
);
assert.equal(eras.eras.length, 12);
assert.deepEqual(
  eras.eras.map((era) => era.index),
  Array.from({ length: 12 }, (_, index) => index)
);
assert.ok(milestones.milestones.every((milestone) => milestone.state === "ADMITTED"));
assert.ok(
  milestones.milestones.every((milestone) => milestone.evidence.length > 0)
);
for (const [name, expected] of Object.entries(manifest.files)) {
  assert.equal(hash(name), expected, `${name} should match the manifest integrity value`);
}

console.log("ok - Genesis historical archive and evidence manifest authority verified");
