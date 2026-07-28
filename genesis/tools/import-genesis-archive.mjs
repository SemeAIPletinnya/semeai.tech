import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const genesisRoot = path.resolve(toolDir, "..");
const selectionPath = path.join(genesisRoot, "data", "source", "twitter-selection.json");
const assignment = "window.YTD.tweets.part0 = ";

function parseArguments(argv) {
  const options = { archiveRoot: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--twitter-archive") options.archiveRoot = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!options.archiveRoot) throw new Error("--twitter-archive is required");
  return options;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const options = parseArguments(process.argv.slice(2));
const selection = JSON.parse(fs.readFileSync(selectionPath, "utf8"));
if (
  crypto
    .createHash("sha256")
    .update(path.basename(options.archiveRoot), "utf8")
    .digest("hex") !== selection.source_archive_basename_sha256
) {
  throw new Error(
    "Archive identity mismatch: selected source does not match the curated export snapshot"
  );
}

const tweetsPath = path.join(options.archiveRoot, "data", "tweets.js");
const raw = fs.readFileSync(tweetsPath, "utf8");
if (!raw.startsWith(assignment)) throw new Error("Unexpected tweets.js envelope");
const tweets = new Map(
  JSON.parse(raw.slice(assignment.length)).map((row) => [row.tweet.id_str, row.tweet])
);
const mediaRoot = path.join(options.archiveRoot, "data", "tweets_media");
const mediaFiles = fs.readdirSync(mediaRoot);
const periods = new Map();

for (const curated of selection.artifacts) {
  const tweet = tweets.get(curated.tweet_id);
  if (!tweet) throw new Error(`Selected public post ${curated.tweet_id} is absent`);
  if ((tweet.full_text || "").startsWith("RT @")) {
    throw new Error(`Selected public post ${curated.tweet_id} is a retweet`);
  }

  const publishedAt = new Date(tweet.created_at).toISOString();
  const period = publishedAt.slice(0, 7);
  const periodRoot = path.join(genesisRoot, "archive", period);
  const originalsRoot = path.join(periodRoot, "originals");
  const localMedia = mediaFiles
    .filter((name) => name.startsWith(`${curated.tweet_id}-`))
    .sort();
  const media = localMedia.map((name) => {
    const source = path.join(mediaRoot, name);
    const destinationName = `x-${name}`;
    const destination = path.join(originalsRoot, destinationName);
    fs.mkdirSync(originalsRoot, { recursive: true });
    fs.copyFileSync(source, destination);
    return {
      path: `genesis/archive/${period}/originals/${destinationName}`,
      sha256: sha256(destination),
      bytes: fs.statSync(destination).size,
    };
  });

  const artifactId = `x-${curated.tweet_id}`;
  const recordPath = path.join(originalsRoot, `${artifactId}.json`);
  const record = {
    schema: "semeai.genesis.public-x-record.v1",
    id: artifactId,
    source: {
      type: "PUBLIC_X_POST",
      account_login: selection.account_login,
      post_id: curated.tweet_id,
      published_at: publishedAt,
      public_url: `https://x.com/${selection.account_login}/status/${curated.tweet_id}`,
      archive_id: selection.archive_id,
    },
    record: {
      text: tweet.full_text || "",
      language: tweet.lang || null,
      expanded_urls: (tweet.entities?.urls || [])
        .map((entry) => entry.expanded_url)
        .filter(Boolean),
    },
    admission: {
      state: curated.state,
      era_ids: curated.era_ids,
      claims_supported: curated.claims_supported,
      historical_framing: curated.historical_framing,
      curation_note: curated.curation_note,
    },
    media,
  };
  writeJson(recordPath, record);

  const entry = {
    id: artifactId,
    state: curated.state,
    published_at: publishedAt,
    source_url: record.source.public_url,
    record_path: `genesis/archive/${period}/originals/${artifactId}.json`,
    record_sha256: sha256(recordPath),
    media,
    era_ids: curated.era_ids,
    claims_supported: curated.claims_supported,
    historical_framing: curated.historical_framing,
    curation_note: curated.curation_note,
  };
  if (!periods.has(period)) periods.set(period, []);
  periods.get(period).push(entry);
}

for (const [period, artifacts] of periods) {
  writeJson(path.join(genesisRoot, "archive", period, "metadata.json"), {
    schema: "semeai.genesis.archive-period.v1",
    period,
    archive_id: selection.archive_id,
    source_boundary: "Curated public X records only; private archive data is excluded.",
    artifacts: artifacts.sort((left, right) =>
      left.published_at.localeCompare(right.published_at)
    ),
  });
}

console.log(`Imported ${selection.artifacts.length} curated public records`);
