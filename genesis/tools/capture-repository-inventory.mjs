import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const genesisRoot = path.resolve(toolDir, "..");
const defaultOutput = path.join(genesisRoot, "data", "source", "repositories.snapshot.json");
const owner = "SemeAIPletinnya";

function parseArguments(argv) {
  const options = { output: defaultOutput, capturedAt: new Date().toISOString() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output") options.output = path.resolve(argv[++index]);
    else if (argv[index] === "--captured-at") options.capturedAt = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!Number.isFinite(Date.parse(options.capturedAt))) {
    throw new Error("--captured-at must be an ISO-8601 timestamp");
  }
  return options;
}

function runGh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
}

function ghJson(endpoint) {
  return JSON.parse(runGh(["api", endpoint]));
}

function ghIncluded(endpoint) {
  const response = runGh(["api", "-i", endpoint]);
  const bodyIndex = response.search(/\r?\n\r?\n[\[{]/);
  if (bodyIndex < 0) throw new Error(`Unable to split GitHub response for ${endpoint}`);
  const header = response.slice(0, bodyIndex);
  const body = response.slice(bodyIndex).replace(/^\r?\n\r?\n/, "");
  return { header, body: JSON.parse(body) };
}

function lastPageFromHeader(header) {
  const match = header.match(/<[^>]+[?&]page=(\d+)>;\s*rel="last"/i);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function publicCommit(commit) {
  if (!commit) return null;
  return {
    sha: commit.sha,
    committed_at: commit.commit?.committer?.date || commit.commit?.author?.date || null,
    url: commit.html_url,
  };
}

function captureHistory(name, defaultBranch) {
  const endpoint = `repos/${owner}/${encodeURIComponent(name)}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=1`;
  try {
    const first = ghIncluded(endpoint);
    const latest = first.body[0] || null;
    const lastPage = lastPageFromHeader(first.header);
    const oldest =
      lastPage === 1
        ? latest
        : ghJson(`${endpoint}&page=${lastPage}`)[0] || null;
    return {
      commit_count: lastPage,
      first_commit: publicCommit(oldest),
      current_head: publicCommit(latest),
    };
  } catch (error) {
    return {
      commit_count: 0,
      first_commit: null,
      current_head: null,
      capture_error: String(error.message || error),
    };
  }
}

const options = parseArguments(process.argv.slice(2));
const repositories = ghJson(
  `users/${owner}/repos?per_page=100&type=owner&sort=created&direction=asc`
);

const normalized = repositories.map((repository) => {
  const history = captureHistory(repository.name, repository.default_branch);
  return {
    id: repository.name,
    github_id: repository.id,
    full_name: repository.full_name,
    html_url: repository.html_url,
    created_at: repository.created_at,
    updated_at: repository.updated_at,
    pushed_at: repository.pushed_at,
    default_branch: repository.default_branch,
    fork: repository.fork,
    parent_full_name: repository.parent?.full_name || null,
    archived: repository.archived,
    visibility: repository.visibility,
    description: repository.description || "",
    language: repository.language || null,
    license: repository.license?.spdx_id || null,
    ...history,
  };
});

const snapshot = {
  schema: "semeai.genesis.repository-snapshot.v1",
  account: owner,
  captured_at: new Date(options.capturedAt).toISOString(),
  source: "GitHub REST API via authenticated gh CLI",
  repositories: normalized,
};

fs.mkdirSync(path.dirname(options.output), { recursive: true });
fs.writeFileSync(options.output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Captured ${normalized.length} repositories -> ${options.output}`);
