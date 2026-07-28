import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CONCEPT_PATTERNS = Object.freeze({
  PLETINNYA: /\bpletinnya\b|плетіння/iu,
  SEMEAI: /\bsemeai\b|\bsemeai_tech\b/iu,
  PROOF_OF_RESONANCE: /\bproof[\s-]*of[\s-]*resonance\b|\bpor\b/iu,
  SILENCE_AS_CONTROL: /\bsilence[\s-]*as[\s-]*control\b/iu,
  RELEASE_AUTHORITY: /generation.{0,80}release|candidate.{0,80}release|release.{0,40}(authority|decision)/isu,
  DIRECTIVE_CORE: /directive[\s-]*core/iu,
  PATH_NETWORK: /path[\s-]*network/iu,
  KNOWLEDGE_ARCHIVE: /knowledge[\s-]*archive|living[\s-]*archive/iu,
  RECEIPT: /\breceipt\b/iu,
  BENCHMARK: /\bbenchmark\b/iu,
  WORKSPACE: /\bworkspace\b/iu,
  GET_JOB: /\bget job\b/iu,
});

const TWITTER_PRIVATE_DATASETS = new Set([
  "account.js",
  "account-creation-ip.js",
  "contact.js",
  "device-token.js",
  "direct-message-group-headers.js",
  "direct-message-headers.js",
  "direct-messages-group.js",
  "direct-messages.js",
  "email-address-change.js",
  "ip-audit.js",
  "message-event.js",
  "phone-number.js",
]);

const TWITTER_PUBLIC_DATASETS = new Set([
  "community-tweet.js",
  "deleted-tweets.js",
  "note-tweet.js",
  "tweet-headers.js",
  "tweets.js",
]);

function parseArgs(argv) {
  const result = { resume: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--chatgpt-archive") result.chatgpt = path.resolve(argv[++index]);
    else if (arg === "--twitter-archive") result.twitter = path.resolve(argv[++index]);
    else if (arg === "--output") result.output = path.resolve(argv[++index]);
    else if (arg === "--no-resume") result.resume = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!result.chatgpt || !result.twitter || !result.output) {
    throw new Error("--chatgpt-archive, --twitter-archive, and --output are required");
  }
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashFile(file) {
  const hash = crypto.createHash("sha256");
  const bytes = fs.readFileSync(file);
  hash.update(bytes);
  return hash.digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}

function walk(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function inventory(root) {
  const files = walk(root);
  const formats = new Map();
  for (const file of files) {
    const extension = path.extname(file).toLowerCase() || "[none]";
    const row = formats.get(extension) || { extension, files: 0, bytes: 0 };
    row.files += 1;
    row.bytes += fs.statSync(file).size;
    formats.set(extension, row);
  }
  return {
    archive_id: path.basename(root),
    files: files.length,
    directories: new Set(files.map((file) => path.dirname(path.relative(root, file)))).size,
    bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0),
    formats: [...formats.values()].sort((left, right) => right.files - left.files),
  };
}

function flattenChatGptText(conversation) {
  const texts = [];
  for (const node of Object.values(conversation.mapping || {})) {
    const content = node?.message?.content;
    for (const part of content?.parts || []) {
      if (typeof part === "string") texts.push(part);
      else if (part && typeof part === "object" && typeof part.text === "string") {
        texts.push(part.text);
      }
    }
  }
  return texts.join("\n");
}

function flattenCodexText(conversation) {
  const texts = [];
  for (const turn of conversation.turns || []) {
    if (typeof turn.custom_instructions === "string") texts.push(turn.custom_instructions);
    for (const item of turn.input_items || []) {
      for (const content of item.content || []) {
        if (typeof content === "string") texts.push(content);
        else if (typeof content?.text === "string") texts.push(content.text);
      }
    }
  }
  return texts.join("\n");
}

function concepts(text) {
  return Object.entries(CONCEPT_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name)
    .sort();
}

function cachedPart({ archiveRoot, sourceFile, outputRoot, resume, reader }) {
  const relative = path.relative(archiveRoot, sourceFile).replaceAll("\\", "/");
  const sourceHash = hashFile(sourceFile);
  const cacheId = sha256(`${path.basename(archiveRoot)}:${relative}`).slice(0, 20);
  const cacheFile = path.join(outputRoot, "parts", `${cacheId}.json`);
  if (resume && fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (cached.source_sha256 === sourceHash) return { ...cached, reused: true };
  }
  const part = reader(sourceFile, relative, sourceHash);
  writeJson(cacheFile, part);
  return { ...part, reused: false };
}

function readChatGptPart(sourceFile, relative, sourceHash) {
  const rows = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  const isCodex = path.basename(sourceFile).startsWith("codex-");
  const candidates = [];
  let minTimestamp = null;
  let maxTimestamp = null;
  for (const row of rows) {
    const text = isCodex ? flattenCodexText(row) : flattenChatGptText(row);
    const matched = concepts(text);
    const timestamp =
      typeof row.create_time === "number"
        ? new Date(row.create_time * 1000).toISOString()
        : null;
    if (timestamp && (!minTimestamp || timestamp < minTimestamp)) minTimestamp = timestamp;
    if (timestamp && (!maxTimestamp || timestamp > maxTimestamp)) maxTimestamp = timestamp;
    if (!matched.length) continue;
    const stableId = String(row.id || row.conversation_id || "");
    candidates.push({
      artifact_id: `private-${sha256(stableId).slice(0, 24)}`,
      source_class: isCodex ? "PRIVATE_ARCHIVE" : "PRIVATE_CONVERSATION",
      timestamp,
      timestamp_confidence: timestamp ? "HIGH" : "UNKNOWN",
      candidate_concepts: matched,
      content_sha256: sha256(text),
      admission_state: "WITHHOLD",
      admission_reason: "private_raw_archive",
    });
  }
  candidates.sort((left, right) =>
    String(left.timestamp || "").localeCompare(String(right.timestamp || "")) ||
    left.artifact_id.localeCompare(right.artifact_id)
  );
  return {
    schema: "semeai.genesis.local-index-part.v1",
    source_file: relative,
    source_sha256: sourceHash,
    records: rows.length,
    min_timestamp: minTimestamp,
    max_timestamp: maxTimestamp,
    candidates,
  };
}

function parseTwitterEnvelope(sourceFile) {
  const raw = fs.readFileSync(sourceFile, "utf8");
  const assignment = "window.YTD.tweets.part0 = ";
  if (!raw.startsWith(assignment)) throw new Error("Unexpected tweets.js envelope");
  return JSON.parse(raw.slice(assignment.length));
}

function readTwitterPart(sourceFile, relative, sourceHash) {
  const rows = parseTwitterEnvelope(sourceFile);
  const candidates = [];
  for (const wrapper of rows) {
    const tweet = wrapper.tweet || wrapper;
    const text = String(tweet.full_text || "");
    const matched = concepts(text);
    if (!matched.length) continue;
    candidates.push({
      artifact_id: `x-${tweet.id_str}`,
      source_class: "PUBLIC_FIRST_PARTY_POST",
      timestamp: new Date(tweet.created_at).toISOString(),
      timestamp_confidence: "HIGH",
      candidate_concepts: matched,
      content_sha256: sha256(text),
      reply_to: tweet.in_reply_to_status_id_str || null,
      representation: text.startsWith("RT @") ? "RETWEET" : "AUTHORED_POST",
      public_url: `https://x.com/adelayida210519/status/${tweet.id_str}`,
      admission_state: "REVIEW",
      admission_reason: "candidate_requires_claim_boundary_and_corroboration",
    });
  }
  candidates.sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp) ||
    left.artifact_id.localeCompare(right.artifact_id)
  );
  return {
    schema: "semeai.genesis.local-index-part.v1",
    source_file: relative,
    source_sha256: sourceHash,
    records: rows.length,
    min_timestamp: candidates[0]?.timestamp || null,
    max_timestamp: candidates.at(-1)?.timestamp || null,
    candidates,
  };
}

function classifyTwitterDatasets(root) {
  return fs
    .readdirSync(path.join(root, "data"), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      dataset: entry.name,
      privacy_classification: TWITTER_PRIVATE_DATASETS.has(entry.name)
        ? "WITHHOLD_PRIVATE"
        : TWITTER_PUBLIC_DATASETS.has(entry.name)
          ? "PUBLIC_OR_PUBLICATION_TRACE"
          : "NOT_INDEXED_UNKNOWN_OR_ACCOUNT_METADATA",
    }))
    .sort((left, right) => left.dataset.localeCompare(right.dataset, "en"));
}

const options = parseArgs(process.argv.slice(2));
for (const root of [options.chatgpt, options.twitter]) {
  if (!fs.statSync(root).isDirectory()) throw new Error(`Archive is not a directory: ${root}`);
}
fs.mkdirSync(options.output, { recursive: true });

const chatgptFiles = fs
  .readdirSync(options.chatgpt)
  .filter((name) => /^(?:conversations|codex)-\d+\.json$/.test(name))
  .sort()
  .map((name) => path.join(options.chatgpt, name));
const chatgptParts = chatgptFiles.map((sourceFile) =>
  cachedPart({
    archiveRoot: options.chatgpt,
    sourceFile,
    outputRoot: options.output,
    resume: options.resume,
    reader: readChatGptPart,
  })
);
const twitterPart = cachedPart({
  archiveRoot: options.twitter,
  sourceFile: path.join(options.twitter, "data", "tweets.js"),
  outputRoot: options.output,
  resume: options.resume,
  reader: readTwitterPart,
});

const chatgptCandidates = chatgptParts.flatMap((part) => part.candidates);
const twitterCandidates = twitterPart.candidates;
const reusedParts = [...chatgptParts, twitterPart].filter((part) => part.reused).length;
const result = {
  schema: "semeai.genesis.local-archaeology-index.v1",
  privacy_boundary: {
    raw_archives_are_publication_authority: false,
    private_conversation_content_retained: false,
    raw_text_retained_in_index: false,
    public_candidates_are_automatically_admitted: false,
  },
  inventories: {
    chatgpt: inventory(options.chatgpt),
    twitter: inventory(options.twitter),
  },
  indexed: {
    chatgpt_records: chatgptParts.reduce((sum, part) => sum + part.records, 0),
    twitter_public_posts: twitterPart.records,
    chatgpt_candidate_records: chatgptCandidates.length,
    twitter_candidate_records: twitterCandidates.length,
  },
  twitter_datasets: classifyTwitterDatasets(options.twitter),
  candidates: {
    private_chronology: chatgptCandidates,
    public_posts: twitterCandidates,
  },
};
writeJson(path.join(options.output, "archive-index.json"), result);
writeJson(path.join(options.output, "checkpoint.json"), {
  schema: "semeai.genesis.local-index-checkpoint.v1",
  parts: [...chatgptParts, twitterPart].map((part) => ({
    source_file: part.source_file,
    source_sha256: part.source_sha256,
    records: part.records,
  })),
});

console.log(
  JSON.stringify({
    output: options.output,
    chatgpt_records: result.indexed.chatgpt_records,
    twitter_public_posts: result.indexed.twitter_public_posts,
    private_candidates: chatgptCandidates.length,
    public_candidates: twitterCandidates.length,
    reused_parts: reusedParts,
  })
);
