(function initRepositoryBenchmark(globalScope) {
  "use strict";

  const DEFAULT_REPOSITORY = "SemeAIPletinnya/silence-as-control";
  const ANALYZER_VERSION = "1.0.0";
  const SCORING_POLICY_VERSION = "semeai.repository-evidence.score.v1";
  const SNAPSHOT_SCHEMA_VERSION = "semeai.repository-evidence.snapshot.v1";
  const API_ROOT = "https://api.github.com";
  const REQUEST_TIMEOUT_MS = 9000;
  const MAX_TREE_ENTRIES = 10000;
  const MAX_TREE_BYTES = 4 * 1024 * 1024;
  const MAX_README_BYTES = 64 * 1024;
  const MAX_DOCUMENT_BYTES = 48 * 1024;
  const MAX_JSON_BYTES = 512 * 1024;
  const FALLBACK_PATH = "./data/silence-as-control.snapshot.json";
  const SELECTED_DOCUMENT_PATHS = Object.freeze([
    "docs/runtime_decision_contract.md",
    "docs/review_release_receipt_layer.md",
  ]);

  const SCORING_POLICY = Object.freeze([
    {
      key: "implementation",
      name: "Implementation Evidence",
      max: 20,
      items: [
        { key: "source_structure", label: "Source or application structure", points: 5, basis: "Path-name heuristic" },
        { key: "package_manifest", label: "Installable or package manifest", points: 4, basis: "Path-name heuristic" },
        { key: "executable_surface", label: "CLI, API, or runtime entry surface", points: 4, basis: "Path-name heuristic" },
        { key: "examples", label: "Examples or runnable demonstrations", points: 3, basis: "Path-name heuristic" },
        { key: "packaging_runtime", label: "Container or runtime packaging", points: 2, basis: "Path-name heuristic" },
        { key: "configuration", label: "Visible configuration surface", points: 2, basis: "Path-name heuristic" },
      ],
    },
    {
      key: "tests",
      name: "Tests & Reproducibility",
      max: 20,
      items: [
        { key: "tests", label: "Test files", points: 6, basis: "Presence only; not a passing-test claim" },
        { key: "ci_workflows", label: "CI workflow paths", points: 4, basis: "Presence only; not a successful-run claim" },
        { key: "fixtures", label: "Deterministic fixtures", points: 3, basis: "Path-name heuristic" },
        { key: "dependency_manifests", label: "Dependency manifests", points: 2, basis: "Path-name heuristic" },
        { key: "reproduction_guides", label: "Reproduction guidance", points: 3, basis: "Documentation-path heuristic" },
        { key: "release_checks", label: "Release or validation checks", points: 2, basis: "Path-name heuristic" },
      ],
    },
    {
      key: "evidence",
      name: "Evidence & Receipts",
      max: 20,
      items: [
        { key: "benchmark_artifacts", label: "Benchmark artifacts", points: 4, basis: "Path-name heuristic" },
        { key: "evidence_maps", label: "Evidence maps or manifests", points: 4, basis: "Path-name heuristic" },
        { key: "receipt_artifacts", label: "Receipt-related artifacts", points: 3, basis: "Path-name heuristic" },
        { key: "machine_results", label: "Machine-readable result artifacts", points: 4, basis: "File-format and path heuristic" },
        { key: "replay_results", label: "Replay result artifacts", points: 3, basis: "Path-name heuristic" },
        { key: "validation_outputs", label: "Documented validation outputs", points: 2, basis: "Path-name heuristic" },
      ],
    },
    {
      key: "continuity",
      name: "Continuity & Replay",
      max: 15,
      items: [
        { key: "changelog", label: "Changelog", points: 3, basis: "Path-name heuristic" },
        { key: "public_release", label: "Published GitHub release", points: 2, basis: "Public GitHub release metadata" },
        { key: "roadmap_milestones", label: "Roadmap or milestones", points: 3, basis: "Documentation-path heuristic" },
        { key: "replay_tooling", label: "Replay tooling", points: 3, basis: "Path-name heuristic" },
        { key: "continuity_docs", label: "Chronology or continuity documentation", points: 2, basis: "Documentation-path heuristic" },
        { key: "recent_default_commit", label: "Default-branch commit within 365 days of capture", points: 2, basis: "GitHub commit metadata" },
      ],
    },
    {
      key: "release_control",
      name: "Release-Control Discipline",
      max: 15,
      items: [
        { key: "gate_policy_paths", label: "Gate or release-policy paths", points: 4, basis: "Path-name heuristic" },
        { key: "documented_tristate", label: "PROCEED / NEEDS_REVIEW / SILENCE documented", points: 3, basis: "Bounded documentation text match" },
        { key: "release_mediation", label: "Release mediation surface", points: 3, basis: "Path-name heuristic" },
        { key: "policy_tests", label: "Policy-focused tests", points: 2, basis: "Presence only; not a passing-test claim" },
        { key: "decision_evidence", label: "Decision evidence or receipt linkage", points: 3, basis: "Documentation-path heuristic" },
      ],
    },
    {
      key: "research",
      name: "Research & Documentation",
      max: 5,
      items: [
        { key: "architecture_docs", label: "Architecture documentation", points: 2, basis: "Documentation-path heuristic" },
        { key: "research_paper", label: "Research paper surface", points: 2, basis: "Path-name heuristic" },
        { key: "external_review_docs", label: "External-review documentation", points: 1, basis: "Documentation-path heuristic" },
      ],
    },
    {
      key: "external",
      name: "External Public Signal",
      max: 5,
      items: [
        { key: "public_visibility", label: "Public repository visibility", points: 1, basis: "GitHub metadata" },
        { key: "stars_present", label: "At least one public star", points: 1, basis: "GitHub stars snapshot" },
        { key: "stars_100", label: "At least 100 public stars", points: 1, basis: "GitHub stars snapshot" },
        { key: "forks_present", label: "At least one public fork", points: 1, basis: "GitHub forks snapshot" },
        { key: "public_release", label: "Published GitHub release", points: 1, basis: "Public GitHub release metadata" },
      ],
    },
  ]);

  class BenchmarkError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = "BenchmarkError";
      this.code = code;
      this.details = details || null;
    }
  }

  function normalizeRepositoryInput(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw || raw.length > 220) {
      throw new BenchmarkError("malformed_input", "Enter a valid public GitHub owner/repository.");
    }

    let owner;
    let repository;
    if (/^https?:\/\//i.test(raw)) {
      let parsed;
      try {
        parsed = new URL(raw);
      } catch (_error) {
        throw new BenchmarkError("malformed_input", "The GitHub repository URL is malformed.");
      }
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        !["github.com", "www.github.com"].includes(parsed.hostname.toLowerCase()) ||
        parsed.port ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash
      ) {
        throw new BenchmarkError("malformed_input", "Use a direct github.com/owner/repository URL without query parameters.");
      }
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length !== 2) {
        throw new BenchmarkError("malformed_input", "The GitHub URL must identify exactly one owner and repository.");
      }
      [owner, repository] = segments;
    } else {
      const segments = raw.split("/");
      if (segments.length !== 2) {
        throw new BenchmarkError("malformed_input", "Use the owner/repository format.");
      }
      [owner, repository] = segments;
    }

    if (repository.toLowerCase().endsWith(".git")) {
      repository = repository.slice(0, -4);
    }
    const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
    const repositoryPattern = /^[A-Za-z0-9._-]{1,100}$/;
    if (
      !ownerPattern.test(owner) ||
      !repositoryPattern.test(repository) ||
      repository === "." ||
      repository === ".." ||
      owner.includes("--")
    ) {
      throw new BenchmarkError("malformed_input", "The owner or repository name contains unsupported characters.");
    }

    return {
      owner,
      repository,
      fullName: `${owner}/${repository}`,
    };
  }

  function canonicalize(value) {
    if (Array.isArray(value)) {
      return value.map(canonicalize);
    }
    if (value && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce((result, key) => {
          result[key] = canonicalize(value[key]);
          return result;
        }, {});
    }
    return value;
  }

  function stableStringify(value) {
    return JSON.stringify(canonicalize(value));
  }

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(String(value));
    let digest;
    if (globalScope.crypto && globalScope.crypto.subtle) {
      digest = await globalScope.crypto.subtle.digest("SHA-256", bytes);
    } else if (typeof require === "function") {
      return require("node:crypto").createHash("sha256").update(bytes).digest("hex");
    } else {
      throw new BenchmarkError("integrity_unavailable", "SHA-256 integrity hashing is unavailable in this browser.");
    }
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function apiUrl(owner, repository, suffix) {
    const safeOwner = encodeURIComponent(owner);
    const safeRepository = encodeURIComponent(repository);
    return `${API_ROOT}/repos/${safeOwner}/${safeRepository}${suffix}`;
  }

  function contentPath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  async function readBoundedResponse(response, maxBytes) {
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength && declaredLength > maxBytes) {
      throw new BenchmarkError("response_too_large", `GitHub response exceeded the ${maxBytes}-byte limit.`);
    }

    if (!response.body || !response.body.getReader) {
      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength > maxBytes) {
        throw new BenchmarkError("response_too_large", `GitHub response exceeded the ${maxBytes}-byte limit.`);
      }
      return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new BenchmarkError("response_too_large", `GitHub response exceeded the ${maxBytes}-byte limit.`);
      }
      chunks.push(next.value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return new TextDecoder("utf-8", { fatal: false }).decode(merged);
  }

  async function fetchBounded(url, options) {
    const settings = options || {};
    const parsed = new URL(url, globalScope.location ? globalScope.location.href : API_ROOT);
    const isApiRequest = parsed.origin === API_ROOT;
    if (!isApiRequest && !settings.allowLocal) {
      throw new BenchmarkError("unsafe_url", "The analyzer refused a non-GitHub API request.");
    }
    if (isApiRequest && parsed.protocol !== "https:") {
      throw new BenchmarkError("unsafe_url", "The analyzer requires HTTPS GitHub API requests.");
    }

    const controller = new AbortController();
    const timer = globalScope.setTimeout(() => controller.abort(), settings.timeout || REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(parsed.href, {
        method: "GET",
        mode: isApiRequest ? "cors" : "same-origin",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        headers: isApiRequest
          ? {
              Accept: settings.accept || "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            }
          : { Accept: "application/json" },
      });
    } catch (error) {
      globalScope.clearTimeout(timer);
      if (error && error.name === "AbortError") {
        throw new BenchmarkError("timeout", "GitHub did not respond within the request timeout.");
      }
      throw new BenchmarkError("network_error", "The GitHub public API could not be reached.");
    }
    globalScope.clearTimeout(timer);

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (response.status === 403 && remaining === "0") {
        throw new BenchmarkError("rate_limited", "GitHub's unauthenticated public API rate limit was reached.");
      }
      if (response.status === 404) {
        throw new BenchmarkError("not_found", "The repository is missing, private, deleted, or inaccessible.");
      }
      if (response.status === 403) {
        throw new BenchmarkError("inaccessible", "GitHub denied access to this repository evidence.");
      }
      if (response.status >= 500) {
        throw new BenchmarkError("server_error", "GitHub's public API returned a server error.");
      }
      throw new BenchmarkError("github_error", `GitHub returned HTTP ${response.status}.`);
    }

    const text = await readBoundedResponse(response, settings.maxBytes || MAX_JSON_BYTES);
    if (settings.responseType === "text") return text;
    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new BenchmarkError("unsafe_response", "GitHub returned an unreadable response.");
    }
  }

  async function fetchOptional(url, options) {
    try {
      return await fetchBounded(url, options);
    } catch (error) {
      if (error instanceof BenchmarkError && error.code === "not_found") return null;
      throw error;
    }
  }

  function findPaths(paths, pattern, limit) {
    return paths.filter((path) => pattern.test(path)).slice(0, limit || 2);
  }

  function deriveEvidence(snapshot, paths, documentTerms) {
    const metadata = snapshot.public_metadata || {};
    const release = metadata.latest_release;
    const captureTime = Date.parse(snapshot.captured_at);
    const commitTime = Date.parse(snapshot.commit_date);
    const recentCommit = Number.isFinite(captureTime) && Number.isFinite(commitTime) && captureTime - commitTime <= 365 * 24 * 60 * 60 * 1000;
    const triStatePaths = Object.keys(documentTerms || {}).filter((path) => {
      const terms = documentTerms[path] || {};
      return terms.proceed && terms.needsReview && terms.silence;
    });

    return {
      source_structure: findPaths(paths, /^(src|lib|app|api)\/.+\.(?:py|js|ts|go|rs|java|rb|php|cs)$/i),
      package_manifest: findPaths(paths, /^(?:pyproject\.toml|setup\.py|package\.json|cargo\.toml|go\.mod|pom\.xml)$/i),
      executable_surface: findPaths(paths, /(?:^|\/)(?:main|cli|server|runtime|api|por_gate)(?:[_./-]|$).+\.(?:py|js|ts|go|rs)$/i),
      examples: findPaths(paths, /^(?:examples?|demos?)\//i),
      packaging_runtime: findPaths(paths, /^(?:dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/i),
      configuration: findPaths(paths, /(?:^\.env\.example$|(?:^|\/)(?:config|settings)\.(?:py|js|ts|toml|ya?ml|json)$)/i),
      tests: findPaths(paths, /(?:^|\/)(?:tests?|specs?)\/.*(?:test|spec)|(?:^|\/)(?:test_|.*\.test\.)/i),
      ci_workflows: findPaths(paths, /^\.github\/workflows\/[^/]+\.ya?ml$/i),
      fixtures: findPaths(paths, /(?:^|\/)(?:fixtures?|testdata|golden)(?:\/|_)/i),
      dependency_manifests: findPaths(paths, /^(?:requirements(?:-[^/]+)?\.txt|pyproject\.toml|package-lock\.json|package\.json|poetry\.lock|cargo\.lock|go\.sum)$/i),
      reproduction_guides: findPaths(paths, /(?:^|\/)(?:reproduc|first_run|runbook|quickstart|direct_reproduction)[^/]*\.(?:md|txt)$/i),
      release_checks: findPaths(paths, /(?:test|check|validat)[^/]*(?:release|gate|policy)|(?:release|gate|policy)[^/]*(?:test|check|validat)/i),
      benchmark_artifacts: findPaths(paths, /^(?:benchmarks?|evals?)\//i),
      evidence_maps: findPaths(paths, /(?:^|\/)(?:evidence[_-](?:map|manifest|graph)|evidence\/)/i),
      receipt_artifacts: findPaths(paths, /(?:^|\/)[^/]*receipt[^/]*(?:\.|\/)/i),
      machine_results: findPaths(paths, /^(?:benchmarks?|results?|reports?|evidence)\/.*\.(?:json|jsonl|csv)$/i),
      replay_results: findPaths(paths, /(?:^|\/)replay[^/]*\.(?:json|jsonl|csv)|(?:^|\/)[^/]*replay[^/]*\.(?:json|jsonl|csv)$/i),
      validation_outputs: findPaths(paths, /^(?:reports?|results?|demo_outputs?)\/.*(?:summary|report|results?)[^/]*\.(?:md|json|jsonl|csv)$/i),
      changelog: findPaths(paths, /^(?:changelog|history)(?:\.[^/]+)?$/i),
      public_release: release && release.tag ? [release.tag] : [],
      roadmap_milestones: findPaths(paths, /(?:^|\/)(?:roadmap|milestones?)[^/]*\.(?:md|txt)$/i),
      replay_tooling: findPaths(paths, /(?:^|\/)[^/]*replay[^/]*\.(?:py|js|ts|sh|ps1)$/i),
      continuity_docs: findPaths(paths, /(?:^|\/)(?:chronology|continuity|memory|history)[^/]*\.(?:md|txt)$/i),
      recent_default_commit: recentCommit ? [snapshot.commit_date] : [],
      gate_policy_paths: findPaths(paths, /(?:^|\/)[^/]*(?:gate|release_policy|decision_policy)[^/]*\.(?:py|js|ts|md|ya?ml)$/i),
      documented_tristate: triStatePaths.slice(0, 2),
      release_mediation: findPaths(paths, /(?:^|\/)[^/]*(?:release_control|release_gate|release_mediation)[^/]*\.(?:py|js|ts|md)$/i),
      policy_tests: findPaths(paths, /(?:^|\/)(?:test_|[^/]*\.test\.)[^/]*(?:policy|gate|release)|(?:^|\/)[^/]*(?:policy|gate|release)[^/]*(?:test|spec)/i),
      decision_evidence: findPaths(paths, /(?:^|\/)[^/]*(?:decision[_-](?:evidence|provenance)|evidence[_-]linkage|receipt[_-]layer)[^/]*\.(?:md|json|jsonl)$/i),
      architecture_docs: findPaths(paths, /(?:^|\/)[^/]*architecture[^/]*\.md$/i),
      research_paper: findPaths(paths, /^(?:paper|research)\/.*\.(?:tex|md|pdf|bib)$/i),
      external_review_docs: findPaths(paths, /(?:^|\/)[^/]*external[_-]review[^/]*\.md$/i),
      public_visibility: metadata.visibility === "public" ? ["public"] : [],
      stars_present: Number(metadata.stars) >= 1 ? [`${metadata.stars} stars at capture`] : [],
      stars_100: Number(metadata.stars) >= 100 ? [`${metadata.stars} stars at capture`] : [],
      forks_present: Number(metadata.forks) >= 1 ? [`${metadata.forks} forks at capture`] : [],
    };
  }

  async function collectLiveSnapshot(identity) {
    const repoEndpoint = apiUrl(identity.owner, identity.repository, "");
    const metadata = await fetchBounded(repoEndpoint, { maxBytes: MAX_JSON_BYTES });
    if (!metadata || String(metadata.full_name || "").toLowerCase() !== identity.fullName.toLowerCase()) {
      throw new BenchmarkError("unsafe_response", "GitHub returned repository metadata for an unexpected identity.");
    }
    if (metadata.visibility !== "public" || metadata.private) {
      throw new BenchmarkError("inaccessible", "Only public repository evidence can be benchmarked.");
    }
    const defaultBranch = String(metadata.default_branch || "");
    if (!defaultBranch || defaultBranch.length > 255) {
      throw new BenchmarkError("unsafe_response", "GitHub returned an invalid default branch.");
    }

    const commitUrl = apiUrl(identity.owner, identity.repository, `/commits/${encodeURIComponent(defaultBranch)}`);
    const languagesUrl = apiUrl(identity.owner, identity.repository, "/languages");
    const releasesUrl = apiUrl(identity.owner, identity.repository, "/releases?per_page=1");
    const readmeUrl = apiUrl(identity.owner, identity.repository, "/readme");
    const [commit, languages, releases, readmeText] = await Promise.all([
      fetchBounded(commitUrl, { maxBytes: MAX_JSON_BYTES }),
      fetchBounded(languagesUrl, { maxBytes: 128 * 1024 }),
      fetchOptional(releasesUrl, { maxBytes: 256 * 1024 }),
      fetchOptional(readmeUrl, { maxBytes: MAX_README_BYTES, responseType: "text", accept: "application/vnd.github.raw+json" }),
    ]);
    const commitSha = String(commit && commit.sha ? commit.sha : "");
    if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
      throw new BenchmarkError("unsafe_response", "GitHub returned an invalid default-branch commit SHA.");
    }

    const tree = await fetchBounded(apiUrl(identity.owner, identity.repository, `/git/trees/${commitSha}?recursive=1`), {
      maxBytes: MAX_TREE_BYTES,
    });
    if (!tree || !Array.isArray(tree.tree)) {
      throw new BenchmarkError("unsafe_response", "GitHub returned an unreadable repository tree.");
    }
    if (tree.truncated || tree.tree.length > MAX_TREE_ENTRIES) {
      throw new BenchmarkError("tree_limit", `The repository tree exceeds the ${MAX_TREE_ENTRIES}-entry safety limit.`);
    }
    const paths = tree.tree
      .filter((entry) => entry && entry.type === "blob" && typeof entry.path === "string" && entry.path.length <= 500)
      .map((entry) => entry.path);

    const documents = { "README.md": readmeText || "" };
    const selectedPresent = SELECTED_DOCUMENT_PATHS.filter((path) => paths.includes(path));
    const selectedContents = await Promise.all(
      selectedPresent.map((path) =>
        fetchOptional(apiUrl(identity.owner, identity.repository, `/contents/${contentPath(path)}`), {
          maxBytes: MAX_DOCUMENT_BYTES,
          responseType: "text",
          accept: "application/vnd.github.raw+json",
        }),
      ),
    );
    selectedPresent.forEach((path, index) => {
      documents[path] = selectedContents[index] || "";
    });
    const documentTerms = Object.keys(documents).reduce((result, path) => {
      const text = documents[path];
      result[path] = {
        proceed: /\bPROCEED\b/.test(text),
        needsReview: /\bNEEDS_REVIEW\b/.test(text),
        silence: /\bSILENCE\b/.test(text),
      };
      return result;
    }, {});
    const release = Array.isArray(releases) && releases.length ? releases[0] : null;
    const capturedAt = new Date().toISOString();
    const snapshot = {
      schema_version: SNAPSHOT_SCHEMA_VERSION,
      source_mode: "LIVE GITHUB SNAPSHOT",
      captured_at: capturedAt,
      repository: String(metadata.full_name),
      owner: String(metadata.owner && metadata.owner.login ? metadata.owner.login : identity.owner),
      default_branch: defaultBranch,
      commit_sha: commitSha.toLowerCase(),
      commit_date: String(commit.commit && commit.commit.committer ? commit.commit.committer.date : ""),
      public_metadata: {
        description: typeof metadata.description === "string" ? metadata.description : null,
        html_url: String(metadata.html_url || ""),
        visibility: String(metadata.visibility || "public"),
        fork: Boolean(metadata.fork),
        archived: Boolean(metadata.archived),
        disabled: Boolean(metadata.disabled),
        stars: Number(metadata.stargazers_count || 0),
        forks: Number(metadata.forks_count || 0),
        open_issues: Number(metadata.open_issues_count || 0),
        size_kb: Number(metadata.size || 0),
        created_at: String(metadata.created_at || ""),
        updated_at: String(metadata.updated_at || ""),
        pushed_at: String(metadata.pushed_at || ""),
        license_spdx: metadata.license && metadata.license.spdx_id ? String(metadata.license.spdx_id) : null,
        topics: Array.isArray(metadata.topics) ? metadata.topics.slice(0, 50).map(String) : [],
        languages: languages && typeof languages === "object" ? languages : {},
        latest_release: release
          ? {
              tag: String(release.tag_name || ""),
              published_at: String(release.published_at || ""),
              draft: Boolean(release.draft),
              prerelease: Boolean(release.prerelease),
            }
          : null,
      },
      tree: {
        entry_count: tree.tree.length,
        blob_count: paths.length,
        truncated: false,
      },
      documentation_signals: {
        selected_paths: Object.keys(documents).filter((path) => documents[path]),
        documents_with_tristate_terms: Object.keys(documentTerms).filter((path) => {
          const terms = documentTerms[path];
          return terms.proceed && terms.needsReview && terms.silence;
        }),
      },
    };
    snapshot.normalized_evidence = deriveEvidence(snapshot, paths, documentTerms);
    return snapshot;
  }

  async function loadFallbackSnapshot() {
    const snapshot = await fetchBounded(FALLBACK_PATH, { allowLocal: true, maxBytes: 256 * 1024 });
    if (
      !snapshot ||
      snapshot.schema_version !== SNAPSHOT_SCHEMA_VERSION ||
      String(snapshot.repository).toLowerCase() !== DEFAULT_REPOSITORY.toLowerCase() ||
      snapshot.source_mode !== "BUILT-IN FALLBACK SNAPSHOT"
    ) {
      throw new BenchmarkError("fallback_invalid", "The built-in fallback snapshot failed schema validation.");
    }
    const claimedHash = String(snapshot.snapshot_hash || "");
    const hashInput = { ...snapshot };
    delete hashInput.snapshot_hash;
    const actualHash = await sha256Hex(stableStringify(hashInput));
    if (claimedHash !== actualHash) {
      throw new BenchmarkError("fallback_invalid", "The built-in fallback snapshot failed its integrity check.");
    }
    return snapshot;
  }

  function scoreSnapshot(snapshot) {
    const evidence = snapshot.normalized_evidence || {};
    const categoryScores = SCORING_POLICY.map((category) => {
      const criteria = category.items.map((item) => {
        const support = Array.isArray(evidence[item.key]) ? evidence[item.key].map(String) : [];
        const awarded = support.length > 0;
        return {
          category_key: category.key,
          category: category.name,
          signal: item.key,
          label: item.label,
          points_available: item.points,
          points_awarded: awarded ? item.points : 0,
          awarded,
          basis: item.basis,
          evidence: support,
        };
      });
      return {
        key: category.key,
        name: category.name,
        max: category.max,
        score: criteria.reduce((sum, criterion) => sum + criterion.points_awarded, 0),
        criteria,
      };
    });
    const criteria = categoryScores.flatMap((category) => category.criteria);
    const admittedSignals = criteria.filter((criterion) => criterion.awarded);
    const missingSignals = criteria.filter((criterion) => !criterion.awarded);
    const totalScore = categoryScores.reduce((sum, category) => sum + category.score, 0);
    const warnings = [
      "Path-name evidence is heuristic. It confirms visible structure, not implementation quality or executed behavior.",
      "Test and workflow presence does not establish that tests pass, cover the implementation, or ran for this commit.",
      "Documentation text is a repository claim, not independent verification of correctness, security, compliance, adoption, or production readiness.",
      "Retrieval is not truth: this result is limited to bounded public evidence visible at the recorded commit.",
    ];
    if (snapshot.source_mode === "BUILT-IN FALLBACK SNAPSHOT") {
      warnings.push("This result uses a deterministic built-in snapshot because live GitHub evidence was unavailable; the presentation Gate must return REVIEW.");
    }
    if (snapshot.public_metadata && snapshot.public_metadata.license_spdx === "NOASSERTION") {
      warnings.push("GitHub reported license metadata as NOASSERTION; the benchmark makes no licensing or compliance claim.");
    }
    return {
      snapshot,
      totalScore,
      categoryScores,
      admittedSignals,
      missingSignals,
      heuristicWarnings: warnings,
    };
  }

  function categoryByKey(candidate, key) {
    return candidate.categoryScores.find((category) => category.key === key);
  }

  function runPresentationGate(candidate) {
    if (!candidate || !candidate.snapshot) {
      return { decision: "BLOCK", reasons: ["No bounded repository-evidence candidate was produced."] };
    }
    const snapshot = candidate.snapshot;
    const coreEvidence = ["implementation", "tests", "evidence"]
      .map((key) => categoryByKey(candidate, key))
      .reduce((sum, category) => sum + (category ? category.score : 0), 0);
    if (!snapshot.commit_sha || !snapshot.tree || snapshot.tree.truncated || coreEvidence < 10) {
      return {
        decision: "BLOCK",
        reasons: ["The bounded evidence is insufficient to produce a meaningful repository result."],
      };
    }
    if (snapshot.source_mode === "BUILT-IN FALLBACK SNAPSHOT") {
      return {
        decision: "REVIEW",
        reasons: ["The repository candidate is complete enough to inspect, but it is fallback-based rather than a current live capture."],
      };
    }
    if (snapshot.public_metadata.archived || snapshot.public_metadata.disabled || candidate.totalScore < 35) {
      return {
        decision: "REVIEW",
        reasons: ["The repository is reachable, but its state or evidence depth requires human review before presentation."],
      };
    }
    return {
      decision: "SHOW",
      reasons: [
        "The public repository was reachable and the bounded evidence capture was complete.",
        "The generated language remains limited to visible evidence and does not make a high-risk certification claim.",
      ],
    };
  }

  function computeIndicators(candidate) {
    const implementation = categoryByKey(candidate, "implementation");
    const tests = categoryByKey(candidate, "tests");
    const evidence = categoryByKey(candidate, "evidence");
    const continuity = categoryByKey(candidate, "continuity");
    const releaseControl = categoryByKey(candidate, "release_control");
    const research = categoryByKey(candidate, "research");
    const external = categoryByKey(candidate, "external");
    return {
      repositorySignal: Math.round(((implementation.score + continuity.score + external.score) / 40) * 100),
      evidenceDepth: Math.round(((tests.score + evidence.score + research.score) / 45) * 100),
      gateDiscipline: Math.round((releaseControl.score / 15) * 100),
    };
  }

  function computeVisualPhase(stars) {
    const tier = Math.floor(Math.max(0, Number(stars) || 0) / 1000);
    const visualSeed = tier % 2 === 0 ? 3 : -3;
    return {
      tier,
      visualSeed,
      visualPhase: visualSeed === 3 ? "EXPANSION" : "CONSOLIDATION",
    };
  }

  async function buildReceipt(candidate, gate, visual) {
    const snapshot = candidate.snapshot;
    const receipt = {
      schema_version: "semeai.repository-evidence.presentation-receipt.v1",
      artifact_type: "repository_evidence_presentation_receipt",
      repository: snapshot.repository,
      owner: snapshot.owner,
      source_mode: snapshot.source_mode,
      source_commit_sha: snapshot.commit_sha,
      snapshot_timestamp: snapshot.captured_at,
      analyzer_version: ANALYZER_VERSION,
      scoring_policy_version: SCORING_POLICY_VERSION,
      total_score: candidate.totalScore,
      category_scores: candidate.categoryScores.map((category) => ({
        key: category.key,
        name: category.name,
        score: category.score,
        maximum: category.max,
      })),
      admitted_signals: candidate.admittedSignals.map((signal) => ({
        category: signal.category,
        signal: signal.signal,
        points: signal.points_awarded,
        basis: signal.basis,
        evidence: signal.evidence,
      })),
      missing_signals: candidate.missingSignals.map((signal) => ({
        category: signal.category,
        signal: signal.signal,
        missing_points: signal.points_available,
        basis: signal.basis,
      })),
      heuristic_warnings: candidate.heuristicWarnings,
      presentation_gate: {
        decision: gate.decision,
        decision_reasons: gate.reasons,
        authority_boundary: "This deterministic presentation Gate controls benchmark display only; it is not SaC/PoR release authority.",
      },
      stars_snapshot: Number(snapshot.public_metadata.stars || 0),
      visual_phase: visual.visualPhase,
      visual_seed: visual.visualSeed,
      visual_tier: visual.tier,
      integrity_description: "SHA-256 integrity hash; not a cryptographic signature.",
    };
    receipt.receipt_hash = await sha256Hex(stableStringify(receipt));
    return receipt;
  }

  const Core = Object.freeze({
    DEFAULT_REPOSITORY,
    ANALYZER_VERSION,
    SCORING_POLICY_VERSION,
    SNAPSHOT_SCHEMA_VERSION,
    MAX_TREE_ENTRIES,
    SCORING_POLICY,
    BenchmarkError,
    normalizeRepositoryInput,
    stableStringify,
    sha256Hex,
    deriveEvidence,
    scoreSnapshot,
    runPresentationGate,
    computeIndicators,
    computeVisualPhase,
    buildReceipt,
  });
  globalScope.SemeAIBenchmarkCore = Core;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  }

  if (typeof document === "undefined") return;

  const elements = {
    form: document.getElementById("benchmark-form"),
    input: document.getElementById("repository-input"),
    error: document.getElementById("input-error"),
    runButton: document.getElementById("run-button"),
    resetButton: document.getElementById("reset-button"),
    status: document.getElementById("run-status"),
    statusText: document.getElementById("run-status-text"),
    result: document.getElementById("benchmark-result"),
    blocked: document.getElementById("blocked-result"),
    blockedMessage: document.getElementById("blocked-message"),
    blockedReasons: document.getElementById("blocked-reasons"),
    sourceMode: document.getElementById("source-mode"),
    resultTitle: document.getElementById("result-title"),
    defaultBranch: document.getElementById("default-branch"),
    sourceCommit: document.getElementById("source-commit"),
    snapshotTime: document.getElementById("snapshot-time"),
    gateBadge: document.getElementById("gate-badge"),
    gateDecision: document.getElementById("gate-decision"),
    totalScore: document.getElementById("total-score"),
    repositorySignal: document.getElementById("repository-signal"),
    evidenceDepth: document.getElementById("evidence-depth"),
    gateDiscipline: document.getElementById("gate-discipline"),
    repositorySignalBar: document.getElementById("repository-signal-bar"),
    evidenceDepthBar: document.getElementById("evidence-depth-bar"),
    gateDisciplineBar: document.getElementById("gate-discipline-bar"),
    categoryGrid: document.getElementById("category-grid"),
    criteriaList: document.getElementById("criteria-list"),
    admittedSignals: document.getElementById("admitted-signals"),
    missingSignals: document.getElementById("missing-signals"),
    heuristicWarnings: document.getElementById("heuristic-warnings"),
    heuristicCount: document.getElementById("heuristic-count"),
    calculationToggle: document.getElementById("calculation-toggle"),
    calculationDetail: document.getElementById("calculation-detail"),
    visualPhase: document.getElementById("visual-phase"),
    visualSeed: document.getElementById("visual-seed"),
    receiptHash: document.getElementById("receipt-hash"),
    downloadReceipt: document.getElementById("download-receipt"),
    sigil: document.getElementById("sigil"),
    visualPhasePreview: document.getElementById("visual-phase-preview"),
  };
  let currentReceipt = null;
  let currentReceiptText = null;

  function makeElement(name, className, text) {
    const element = document.createElement(name);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function setStatus(message, state) {
    elements.status.classList.remove("running", "complete");
    if (state) elements.status.classList.add(state);
    elements.statusText.textContent = message;
  }

  function clearLists() {
    [
      elements.blockedReasons,
      elements.categoryGrid,
      elements.criteriaList,
      elements.admittedSignals,
      elements.missingSignals,
      elements.heuristicWarnings,
    ].forEach((element) => element.replaceChildren());
  }

  function renderBlocked(message, reasons) {
    currentReceipt = null;
    currentReceiptText = null;
    elements.downloadReceipt.disabled = true;
    elements.result.hidden = true;
    elements.blocked.hidden = false;
    elements.blockedMessage.textContent = message;
    elements.blockedReasons.replaceChildren();
    (reasons || []).forEach((reason) => elements.blockedReasons.appendChild(makeElement("li", "", reason)));
    setStatus("PRESENTATION GATE / BLOCK — SCORE WITHHELD", "complete");
    elements.blocked.scrollIntoView({ behavior: globalScope.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function renderCategoryBreakdown(candidate) {
    candidate.categoryScores.forEach((category, index) => {
      const card = makeElement("section", "category-card");
      card.appendChild(makeElement("span", "", String(index + 1).padStart(2, "0")));
      card.appendChild(makeElement("h4", "", category.name));
      const score = makeElement("p", "category-score");
      score.appendChild(makeElement("span", "", category.score));
      score.appendChild(makeElement("small", "", `/ ${category.max}`));
      card.appendChild(score);
      elements.categoryGrid.appendChild(card);

      const group = makeElement("section", "criteria-group");
      group.appendChild(makeElement("h4", "", `${category.name} — ${category.score}/${category.max}`));
      const list = makeElement("ul");
      category.criteria.forEach((criterion) => {
        const row = makeElement("li", `criterion${criterion.awarded ? "" : " missing"}`);
        row.appendChild(makeElement("span", "criterion-mark", criterion.awarded ? "+" : "−"));
        const copy = makeElement("span");
        copy.appendChild(document.createTextNode(`${criterion.label} · ${criterion.basis}`));
        copy.appendChild(makeElement("code", "criterion-evidence", criterion.evidence.length ? criterion.evidence.join(" · ") : "No matching bounded evidence"));
        row.appendChild(copy);
        row.appendChild(makeElement("span", "criterion-points", criterion.awarded ? `+${criterion.points_awarded}` : `0 / ${criterion.points_available}`));
        list.appendChild(row);
      });
      group.appendChild(list);
      elements.criteriaList.appendChild(group);
    });
  }

  function renderLedger(candidate, gate) {
    candidate.admittedSignals.forEach((signal) => {
      const item = makeElement("li");
      item.appendChild(makeElement("strong", "", `${signal.label} · +${signal.points_awarded}`));
      item.appendChild(makeElement("code", "", signal.evidence.join(" · ")));
      elements.admittedSignals.appendChild(item);
    });
    candidate.missingSignals.forEach((signal) => {
      const item = makeElement("li");
      item.appendChild(makeElement("strong", "", `${signal.label} · ${signal.points_available} point${signal.points_available === 1 ? "" : "s"} absent`));
      item.appendChild(makeElement("code", "", signal.basis));
      elements.missingSignals.appendChild(item);
    });
    const warnings = [
      ...candidate.heuristicWarnings,
      ...gate.reasons.map((reason) => `Presentation Gate: ${reason}`),
    ];
    warnings.forEach((warning) => elements.heuristicWarnings.appendChild(makeElement("li", "", warning)));
    elements.heuristicCount.textContent = `${candidate.admittedSignals.length} ADMITTED / ${candidate.missingSignals.length} MISSING`;
  }

  function renderResult(candidate, gate, visual, receipt) {
    clearLists();
    const snapshot = candidate.snapshot;
    const indicators = computeIndicators(candidate);
    elements.blocked.hidden = true;
    elements.result.hidden = false;
    elements.sourceMode.textContent = snapshot.source_mode;
    elements.sourceMode.classList.toggle("fallback", snapshot.source_mode === "BUILT-IN FALLBACK SNAPSHOT");
    elements.resultTitle.textContent = snapshot.repository;
    elements.defaultBranch.textContent = snapshot.default_branch;
    elements.sourceCommit.textContent = snapshot.commit_sha;
    elements.snapshotTime.textContent = snapshot.captured_at;
    elements.gateDecision.textContent = gate.decision;
    elements.gateBadge.className = `gate-badge ${gate.decision.toLowerCase()}`;
    elements.totalScore.textContent = candidate.totalScore;
    elements.repositorySignal.textContent = `${indicators.repositorySignal} / 100`;
    elements.evidenceDepth.textContent = `${indicators.evidenceDepth} / 100`;
    elements.gateDiscipline.textContent = `${indicators.gateDiscipline} / 100`;
    elements.visualPhase.textContent = `${visual.visualSeed > 0 ? "+" : ""}${visual.visualSeed} ${visual.visualPhase}`;
    elements.visualSeed.textContent = visual.visualSeed > 0 ? `+${visual.visualSeed}` : String(visual.visualSeed);
    elements.receiptHash.textContent = receipt.receipt_hash;
    elements.visualPhasePreview.textContent = `${visual.visualSeed > 0 ? "+" : ""}${visual.visualSeed} / ${visual.visualPhase}`;
    renderCategoryBreakdown(candidate);
    renderLedger(candidate, gate);
    currentReceipt = receipt;
    currentReceiptText = `${JSON.stringify(receipt, null, 2)}\n`;
    elements.downloadReceipt.disabled = false;
    if (globalScope.SemeAISigil) {
      globalScope.SemeAISigil.renderSigil(elements.sigil, {
        repository: snapshot.repository,
        commitSha: snapshot.commit_sha,
        policyVersion: SCORING_POLICY_VERSION,
        visualSeed: visual.visualSeed,
      });
    }
    globalScope.requestAnimationFrame(() => {
      elements.repositorySignalBar.style.width = `${indicators.repositorySignal}%`;
      elements.evidenceDepthBar.style.width = `${indicators.evidenceDepth}%`;
      elements.gateDisciplineBar.style.width = `${indicators.gateDiscipline}%`;
    });
    setStatus(`${gate.decision} — BENCHMARK CANDIDATE GATED`, "complete");
    elements.result.scrollIntoView({ behavior: globalScope.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  async function runBenchmark(event) {
    event.preventDefault();
    elements.error.textContent = "";
    elements.input.removeAttribute("aria-invalid");
    elements.result.hidden = true;
    elements.blocked.hidden = true;
    elements.runButton.disabled = true;
    elements.downloadReceipt.disabled = true;
    currentReceipt = null;
    currentReceiptText = null;
    setStatus("VALIDATING REPOSITORY IDENTITY", "running");

    let identity;
    try {
      identity = normalizeRepositoryInput(elements.input.value);
    } catch (error) {
      elements.runButton.disabled = false;
      elements.input.setAttribute("aria-invalid", "true");
      elements.error.textContent = error.message;
      renderBlocked(error.message, ["Malformed input is denied before any network request or score generation."]);
      elements.input.focus();
      return;
    }

    let snapshot;
    try {
      setStatus("READING BOUNDED PUBLIC GITHUB EVIDENCE", "running");
      snapshot = await collectLiveSnapshot(identity);
    } catch (error) {
      const fallbackEligible = ["rate_limited", "timeout", "network_error", "server_error"].includes(error.code);
      const isDefault = identity.fullName.toLowerCase() === DEFAULT_REPOSITORY.toLowerCase();
      if (isDefault && fallbackEligible) {
        try {
          setStatus("LIVE CAPTURE UNAVAILABLE — VERIFYING BUILT-IN SNAPSHOT", "running");
          snapshot = await loadFallbackSnapshot();
        } catch (fallbackError) {
          elements.runButton.disabled = false;
          renderBlocked(fallbackError.message, ["The fallback candidate was withheld because its schema or integrity could not be verified."]);
          return;
        }
      } else {
        elements.runButton.disabled = false;
        const reasons = [error.message];
        if (error.code === "tree_limit" || error.code === "response_too_large" || error.code === "unsafe_response") {
          reasons.push("The bounded analyzer refused data outside its safety limits.");
        } else {
          reasons.push("No fallback is permitted for this repository or failure mode.");
        }
        renderBlocked("No meaningful score can be released for this repository.", reasons);
        return;
      }
    }

    setStatus("SCORING ADMITTED EVIDENCE", "running");
    const candidate = scoreSnapshot(snapshot);
    const gate = runPresentationGate(candidate);
    if (gate.decision === "BLOCK") {
      elements.runButton.disabled = false;
      renderBlocked("The presentation Gate withheld the score.", gate.reasons);
      return;
    }
    const visual = computeVisualPhase(snapshot.public_metadata.stars);
    try {
      const receipt = await buildReceipt(candidate, gate, visual);
      renderResult(candidate, gate, visual, receipt);
    } catch (error) {
      renderBlocked("The presentation receipt could not be finalized.", [error.message]);
    } finally {
      elements.runButton.disabled = false;
    }
  }

  elements.form.addEventListener("submit", runBenchmark);
  elements.input.addEventListener("input", () => {
    elements.input.removeAttribute("aria-invalid");
    elements.error.textContent = "";
  });
  elements.resetButton.addEventListener("click", () => {
    elements.input.value = DEFAULT_REPOSITORY;
    elements.input.removeAttribute("aria-invalid");
    elements.error.textContent = "";
    elements.result.hidden = true;
    elements.blocked.hidden = true;
    elements.calculationDetail.hidden = true;
    elements.calculationToggle.setAttribute("aria-expanded", "false");
    elements.downloadReceipt.disabled = true;
    currentReceipt = null;
    currentReceiptText = null;
    setStatus("READY FOR PUBLIC EVIDENCE", "");
    if (globalScope.SemeAISigil) {
      globalScope.SemeAISigil.renderSigil(elements.sigil, {
        repository: DEFAULT_REPOSITORY,
        commitSha: "pending",
        policyVersion: SCORING_POLICY_VERSION,
        visualSeed: 3,
      });
    }
    elements.input.focus();
  });
  elements.calculationToggle.addEventListener("click", () => {
    const expanded = elements.calculationToggle.getAttribute("aria-expanded") === "true";
    elements.calculationToggle.setAttribute("aria-expanded", String(!expanded));
    elements.calculationDetail.hidden = expanded;
  });
  elements.downloadReceipt.addEventListener("click", () => {
    if (!currentReceipt || !currentReceiptText) return;
    const blob = new Blob([currentReceiptText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentReceipt.repository.replace(/[^A-Za-z0-9._-]+/g, "-")}.repository-evidence-receipt.json`;
    link.click();
    globalScope.setTimeout(() => URL.revokeObjectURL(url), 0);
  });

  if (globalScope.SemeAISigil) {
    globalScope.SemeAISigil.renderSigil(elements.sigil, {
      repository: DEFAULT_REPOSITORY,
      commitSha: "pending",
      policyVersion: SCORING_POLICY_VERSION,
      visualSeed: 3,
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
