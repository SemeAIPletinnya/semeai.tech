import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const genesisRoot = path.resolve(toolDir, "..");
const dataRoot = path.join(genesisRoot, "data");
const sourceRoot = path.join(dataRoot, "source");
const checkOnly = process.argv.slice(2).includes("--check");
const allowedStates = new Set(["ARCHIVED", "REVIEWED", "ADMITTED", "WITHHELD"]);
const allowedClassifications = new Set([
  "FIRST_PARTY",
  "EXPERIMENT",
  "SUCCESSOR_DERIVED",
  "FORK",
  "EXTERNAL_REFERENCE",
  "ARCHIVED",
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeOrCheck(file, value) {
  const serialized = stableJson(value);
  if (checkOnly) {
    assert(fs.existsSync(file), `Missing generated file: ${file}`);
    assert(fs.readFileSync(file, "utf8") === serialized, `Generated file is stale: ${file}`);
  } else {
    fs.writeFileSync(file, serialized, "utf8");
  }
}

const periodDirectories = fs
  .readdirSync(path.join(genesisRoot, "archive"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const artifactRows = [];

for (const period of periodDirectories) {
  const metadata = readJson(path.join(genesisRoot, "archive", period, "metadata.json"));
  for (const artifact of metadata.artifacts) {
    assert(allowedStates.has(artifact.state), `Invalid artifact state: ${artifact.id}`);
    const recordFile = path.resolve(path.join(genesisRoot, ".."), artifact.record_path);
    assert(recordFile.startsWith(genesisRoot), `Artifact path escapes Genesis: ${artifact.id}`);
    assert(fs.existsSync(recordFile), `Artifact record missing: ${artifact.id}`);
    assert(sha256(recordFile) === artifact.record_sha256, `Artifact hash mismatch: ${artifact.id}`);
    for (const media of artifact.media) {
      const mediaFile = path.resolve(path.join(genesisRoot, ".."), media.path);
      assert(mediaFile.startsWith(genesisRoot), `Media path escapes Genesis: ${artifact.id}`);
      assert(fs.existsSync(mediaFile), `Artifact media missing: ${media.path}`);
      assert(sha256(mediaFile) === media.sha256, `Artifact media hash mismatch: ${media.path}`);
    }
    if (artifact.state === "ADMITTED") {
      assert(artifact.claims_supported.length > 0, `Admitted artifact lacks bounded claims: ${artifact.id}`);
    }
    artifactRows.push({ period, archive_id: metadata.archive_id, ...artifact });
  }
}

const artifactIds = new Set(artifactRows.map((artifact) => artifact.id));
assert(artifactIds.size === artifactRows.length, "Duplicate artifact ids");
const artifacts = {
  schema: "semeai.genesis.artifacts.v1",
  policy: {
    archive_is_admission: false,
    historical_framing_is_current_claim: false,
    public_posts_are_implementation_proof: false,
  },
  artifacts: artifactRows.sort((left, right) =>
    left.published_at.localeCompare(right.published_at)
  ),
};

const snapshot = readJson(path.join(sourceRoot, "repositories.snapshot.json"));
const classifications = readJson(path.join(sourceRoot, "repository-classifications.json"));
const repositoryRows = snapshot.repositories.map((repository) => {
  const curated = classifications.repositories[repository.id];
  const classification = repository.fork ? "FORK" : curated?.classification;
  assert(classification, `Missing classification for non-fork repository: ${repository.id}`);
  assert(allowedClassifications.has(classification), `Invalid repository classification: ${repository.id}`);
  if (repository.fork) {
    assert(!curated, `Fork must not have a first-party curation override: ${repository.id}`);
  }
  return {
    ...repository,
    classification,
    classification_rationale: repository.fork
      ? `GitHub marks this repository as a fork of ${repository.parent_full_name || "another repository"}.`
      : curated.rationale,
  };
});
const repositoryIds = new Set(repositoryRows.map((repository) => repository.id));
assert(repositoryIds.size === repositoryRows.length, "Duplicate repository ids");
assert(
  Object.keys(classifications.repositories).every((id) => repositoryIds.has(id)),
  "Classification references an unknown repository"
);
const repositories = {
  schema: "semeai.genesis.repositories.v1",
  account: snapshot.account,
  captured_at: snapshot.captured_at,
  policy: classifications.policy,
  summary: {
    total: repositoryRows.length,
    first_party: repositoryRows.filter((item) => item.classification === "FIRST_PARTY").length,
    experiments: repositoryRows.filter((item) => item.classification === "EXPERIMENT").length,
    successors: repositoryRows.filter((item) => item.classification === "SUCCESSOR_DERIVED").length,
    forks: repositoryRows.filter((item) => item.classification === "FORK").length,
    external_references: repositoryRows.filter((item) => item.classification === "EXTERNAL_REFERENCE").length,
    archived: repositoryRows.filter((item) => item.classification === "ARCHIVED").length,
  },
  repositories: repositoryRows,
};

const lineageSource = readJson(path.join(sourceRoot, "lineage.curation.json"));
for (const edge of lineageSource.edges) {
  assert(repositoryIds.has(edge.from), `Lineage source does not exist: ${edge.from}`);
  assert(repositoryIds.has(edge.to), `Lineage target does not exist: ${edge.to}`);
  assert(edge.code_ancestry_claimed === false, `Unproven code ancestry claim: ${edge.from}`);
  const from = repositoryRows.find((repository) => repository.id === edge.from);
  const to = repositoryRows.find((repository) => repository.id === edge.to);
  assert(from.classification !== "FORK" && to.classification !== "FORK", "Fork entered first-party lineage");
}
const lineage = {
  schema: "semeai.genesis.lineage.v1",
  policy: lineageSource.policy,
  edges: lineageSource.edges,
};

const erasSource = readJson(path.join(sourceRoot, "eras.curation.json"));
const eraIds = new Set(erasSource.eras.map((era) => era.id));
assert(eraIds.size === erasSource.eras.length, "Duplicate era ids");
assert(
  erasSource.eras.every((era, index) => era.index === index),
  "Era indexes must be contiguous and chronological"
);
for (const era of erasSource.eras) {
  for (const id of era.artifact_ids) assert(artifactIds.has(id), `Unknown era artifact: ${id}`);
  for (const id of era.repository_ids) assert(repositoryIds.has(id), `Unknown era repository: ${id}`);
}
for (const artifact of artifactRows.filter((item) => item.state === "ADMITTED")) {
  assert(
    erasSource.eras.some((era) => era.artifact_ids.includes(artifact.id)),
    `Admitted artifact is absent from all eras: ${artifact.id}`
  );
}
const eras = {
  schema: "semeai.genesis.eras.v1",
  source_snapshot_at: snapshot.captured_at,
  eras: erasSource.eras,
};

const milestoneSource = readJson(path.join(sourceRoot, "milestones.curation.json"));
for (const milestone of milestoneSource.milestones) {
  assert(eraIds.has(milestone.era_id), `Unknown milestone era: ${milestone.id}`);
  assert(milestone.state === "ADMITTED", `Displayed milestone is not admitted: ${milestone.id}`);
  assert(milestone.evidence.length > 0, `Milestone lacks evidence: ${milestone.id}`);
  for (const evidence of milestone.evidence) {
    if (evidence.type === "artifact") {
      assert(artifactIds.has(evidence.id), `Unknown milestone artifact: ${evidence.id}`);
      const artifact = artifactRows.find((item) => item.id === evidence.id);
      assert(artifact.state === "ADMITTED", `Milestone uses non-admitted artifact: ${evidence.id}`);
    } else if (evidence.type === "repository") {
      assert(repositoryIds.has(evidence.id), `Unknown milestone repository: ${evidence.id}`);
      const repository = repositoryRows.find((item) => item.id === evidence.id);
      assert(repository.classification !== "FORK", `Milestone uses fork as first-party evidence: ${evidence.id}`);
    } else {
      throw new Error(`Unknown evidence type in milestone ${milestone.id}`);
    }
  }
}
const milestones = {
  schema: "semeai.genesis.milestones.v1",
  source_snapshot_at: snapshot.captured_at,
  milestones: milestoneSource.milestones,
};

const generated = [
  ["artifacts.json", artifacts],
  ["repositories.json", repositories],
  ["lineage.json", lineage],
  ["eras.json", eras],
  ["milestones.json", milestones],
];
for (const [name, value] of generated) writeOrCheck(path.join(dataRoot, name), value);

if (!checkOnly) {
  const files = Object.fromEntries(
    generated.map(([name]) => [name, sha256(path.join(dataRoot, name))])
  );
  writeOrCheck(path.join(dataRoot, "manifest.json"), {
    schema: "semeai.genesis.manifest.v1",
    source_snapshot_at: snapshot.captured_at,
    files,
  });
} else {
  const manifest = readJson(path.join(dataRoot, "manifest.json"));
  for (const [name] of generated) {
    assert(manifest.files[name] === sha256(path.join(dataRoot, name)), `Manifest hash is stale: ${name}`);
  }
}

console.log(
  `${checkOnly ? "Verified" : "Built"} ${artifactRows.length} artifacts, ${repositoryRows.length} repositories, ${lineage.edges.length} lineage edges, ${eras.eras.length} eras, and ${milestones.milestones.length} milestones`
);
