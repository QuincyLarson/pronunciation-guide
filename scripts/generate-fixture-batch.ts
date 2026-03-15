import path from "node:path";
import { readFile } from "node:fs/promises";

import { collectFiles, ensureDir, readJsonFile, writeJsonFile } from "../src/lib/build/io";
import { FIXTURE_DIR, FIXTURE_GENERATED_DIR } from "../src/lib/build/paths";
import { slugify } from "../src/lib/slug";

const DEFAULT_TARGET = 1000;
const DEFAULT_BATCH_SIZE = 100;
const WORD_LIST_PATH = "/usr/share/dict/web2";
const PROPER_NAMES_PATH = "/usr/share/dict/propernames";
const MIX_PATTERN = ["word", "word", "name"] as const;
const WORD_TOPICS = ["academic", "medicine"] as const;
const WORD_SOURCE_META = {
  name: "Local system dictionary seed",
  url: "file:///usr/share/dict/web2",
  license: "Host system dictionary list; verify redistribution terms before mirroring.",
  revision: "local-system-dictionary-2026-03-14",
  attribution:
    "Headword imported from a local system dictionary list; gloss and relationship text were authored in-repo for pronunciation lookup coverage.",
  fields: ["display", "glosses", "topics", "variants", "related"],
  confidence: 0.63,
  review_status: "auto-imported" as const
};
const NAME_SOURCE_META = {
  name: "Local system proper-name seed",
  url: "file:///usr/share/dict/propernames",
  license: "Host system proper-name list; verify redistribution terms before mirroring.",
  revision: "local-proper-names-2026-03-14",
  attribution:
    "Headword imported from a local system proper-name list; gloss and relationship text were authored in-repo for pronunciation lookup coverage.",
  fields: ["display", "glosses", "topics", "variants", "related"],
  confidence: 0.67,
  review_status: "auto-imported" as const
};
const AUDIO_TEMPLATE = {
  kind: "synthetic" as const,
  src: "/audio/fixtures/synthetic-sample.wav",
  engine: "say",
  source_name: "Local preview synthesis",
  source_url: "file:///usr/bin/say",
  license: "Local build-time preview asset",
  license_status: "clear" as const,
  review_status: "auto-imported" as const,
  confidence: 0.76
};
const MEDICAL_PATTERNS = [
  /itis$/,
  /emia$/,
  /osis$/,
  /phage$/,
  /philia$/,
  /phobia$/,
  /scopy$/,
  /scope$/,
  /ectomy$/,
  /oma$/,
  /ase$/,
  /algia$/,
  /^cardio/,
  /^gastro/,
  /^neuro/,
  /^derm/,
  /^hema/,
  /^hemo/
];
const TECHNICAL_PATTERNS = [
  /graph/,
  /gram/,
  /logy$/,
  /logue$/,
  /metry$/,
  /meter$/,
  /morph/,
  /glyph/,
  /lex/,
  /ph/,
  /ps/,
  /^hyper/,
  /^hypo/,
  /^poly/,
  /^mono/,
  /^micro/,
  /^macro/,
  /^chrono/,
  /^tele/,
  /^auto/,
  /^para/,
  /^meta/,
  /^epi/,
  /^ana/
];

interface Options {
  count: number;
  target: number;
}

interface RawWiktionaryEntry {
  term: string;
  display: string;
  language: string;
  parts_of_speech: string[];
  definitions: string[];
  short_gloss: string;
  origin: {
    code: string | null;
    name: string | null;
    label: string | null;
  };
  topics: string[];
  pronunciations: Array<{
    id: string;
    label: string;
    locale: string;
    ipa: string | null;
    respelling: string | null;
    notes: string[];
    audio: {
      kind: "synthetic";
      src: string;
      engine: string;
      engine_input: string;
      source_name: string;
      source_url: string;
      license: string;
      license_status: "clear";
      review_status: "auto-imported";
      confidence: number;
    };
  }>;
  related_terms: string[];
  semantic_links: string[];
  confusions: string[];
  confusion_notes: string[];
  search_rank: number;
  badges: ["auto-imported"];
  source: typeof WORD_SOURCE_META;
}

interface Candidate {
  kind: "word" | "name";
  term: string;
  slug: string;
  score: number;
  topic: (typeof WORD_TOPICS)[number] | "news-names";
}

function parseOptions(argv: string[]): Options {
  let count = DEFAULT_BATCH_SIZE;
  let target = DEFAULT_TARGET;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--count" && next) {
      count = Number.parseInt(next, 10);
      index += 1;
    } else if (value === "--target" && next) {
      target = Number.parseInt(next, 10);
      index += 1;
    }
  }

  return {
    count: Number.isFinite(count) && count > 0 ? count : DEFAULT_BATCH_SIZE,
    target: Number.isFinite(target) && target > 0 ? target : DEFAULT_TARGET
  };
}

function roundRobinByInitial(values: Candidate[]): Candidate[] {
  const buckets = new Map<string, Candidate[]>();

  for (const value of values) {
    const key = value.slug.slice(0, 1);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(value);
    } else {
      buckets.set(key, [value]);
    }
  }

  const initials = [...buckets.keys()].sort();
  const result: Candidate[] = [];
  let remaining = true;

  while (remaining) {
    remaining = false;
    for (const initial of initials) {
      const bucket = buckets.get(initial);
      if (!bucket || bucket.length === 0) {
        continue;
      }

      remaining = true;
      result.push(bucket.shift() as Candidate);
    }
  }

  return result;
}

function scoreWord(term: string): number {
  let score = 0;

  if (MEDICAL_PATTERNS.some((pattern) => pattern.test(term))) {
    score += 4;
  }

  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(term))) {
    score += 3;
  }

  if (/[qxzjv]/.test(term)) {
    score += 2;
  }

  if (term.length >= 9) {
    score += 1;
  }

  return score;
}

function scoreName(term: string): number {
  let score = 0;

  if (/[qxzjv]/i.test(term)) {
    score += 2;
  }

  if (term.length >= 7) {
    score += 1;
  }

  if (/[aeiou]{2}/i.test(term)) {
    score += 1;
  }

  return score;
}

function isWordCandidate(value: string): boolean {
  return /^[a-z]+$/.test(value) && value.length >= 6 && value.length <= 14;
}

function isNameCandidate(value: string): boolean {
  return /^[A-Z][a-z]+$/.test(value) && value.length >= 4 && value.length <= 14;
}

function topicForWord(term: string): (typeof WORD_TOPICS)[number] {
  return MEDICAL_PATTERNS.some((pattern) => pattern.test(term)) ? "medicine" : "academic";
}

function loadWordCandidates(raw: string, blockedSlugs: Set<string>): Candidate[] {
  const unique = new Map<string, Candidate>();

  for (const line of raw.split(/\r?\n/)) {
    const term = line.trim();
    if (!isWordCandidate(term)) {
      continue;
    }

    const slug = slugify(term);
    if (blockedSlugs.has(slug) || unique.has(slug)) {
      continue;
    }

    unique.set(slug, {
      kind: "word",
      term,
      slug,
      score: scoreWord(term),
      topic: topicForWord(term)
    });
  }

  return roundRobinByInitial(
    [...unique.values()].sort(
      (left, right) =>
        right.score - left.score || left.slug.localeCompare(right.slug)
    )
  );
}

function loadNameCandidates(raw: string, blockedSlugs: Set<string>): Candidate[] {
  const unique = new Map<string, Candidate>();

  for (const line of raw.split(/\r?\n/)) {
    const term = line.trim();
    if (!isNameCandidate(term)) {
      continue;
    }

    const slug = slugify(term);
    if (blockedSlugs.has(slug) || unique.has(slug)) {
      continue;
    }

    unique.set(slug, {
      kind: "name",
      term,
      slug,
      score: scoreName(term),
      topic: "news-names"
    });
  }

  return roundRobinByInitial(
    [...unique.values()].sort(
      (left, right) =>
        right.score - left.score || left.slug.localeCompare(right.slug)
    )
  );
}

function pickCandidates(
  words: Candidate[],
  names: Candidate[],
  count: number
): Candidate[] {
  const pools = {
    word: [...words],
    name: [...names]
  };
  const selected: Candidate[] = [];
  const selectedSlugs = new Set<string>();

  while (selected.length < count && (pools.word.length > 0 || pools.name.length > 0)) {
    let advanced = false;

    for (const kind of MIX_PATTERN) {
      const pool = pools[kind];
      let candidate = pool.shift();

      while (candidate && selectedSlugs.has(candidate.slug)) {
        candidate = pool.shift();
      }

      if (!candidate) {
        continue;
      }

      selected.push(candidate);
      selectedSlugs.add(candidate.slug);
      advanced = true;

      if (selected.length === count) {
        break;
      }
    }

    if (!advanced) {
      break;
    }
  }

  while (selected.length < count && pools.word.length > 0) {
    const candidate = pools.word.shift() as Candidate;
    if (selectedSlugs.has(candidate.slug)) {
      continue;
    }
    selected.push(candidate);
    selectedSlugs.add(candidate.slug);
  }

  while (selected.length < count && pools.name.length > 0) {
    const candidate = pools.name.shift() as Candidate;
    if (selectedSlugs.has(candidate.slug)) {
      continue;
    }
    selected.push(candidate);
    selectedSlugs.add(candidate.slug);
  }

  return selected;
}

function writeRelatedTerms(entries: RawWiktionaryEntry[]): RawWiktionaryEntry[] {
  const groups = new Map<string, RawWiktionaryEntry[]>();

  for (const entry of entries) {
    const key = entry.topics[0] ?? "general";
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return entries.map((entry) => {
    const group = groups.get(entry.topics[0] ?? "general") ?? [];
    const index = group.findIndex((candidate) => candidate.term === entry.term);
    const related = new Set<string>();

    for (let offset = 1; offset <= Math.min(4, group.length - 1); offset += 1) {
      related.add(group[(index + offset) % group.length]?.term ?? "");
      related.add(group[(index - offset + group.length) % group.length]?.term ?? "");
    }

    related.delete(entry.term);
    related.delete("");

    return {
      ...entry,
      related_terms: [...related].slice(0, 4),
      semantic_links: [...related].slice(0, 2)
    };
  });
}

function buildEntry(candidate: Candidate, searchRank: number): RawWiktionaryEntry {
  const display = candidate.term;
  const isName = candidate.kind === "name";
  const longGloss = isName
    ? `${display} is included as a proper-name pronunciation lookup entry for readers who need a spoken English reference in scripts, broadcasts, and classroom reading.`
    : `${display} is included as an uncommon English headword pronunciation lookup entry so readers can hear a spoken reference and avoid hesitation in live reading.`;
  const shortGloss = isName
    ? "A proper name kept in the directory for pronunciation lookup."
    : "An uncommon English headword kept in the directory for pronunciation lookup.";

  return {
    term: display,
    display,
    language: "en",
    parts_of_speech: isName ? ["proper noun"] : [],
    definitions: [longGloss],
    short_gloss: shortGloss,
    origin: {
      code: null,
      name: null,
      label: null
    },
    topics: [candidate.topic],
    pronunciations: [
      {
        id: isName ? "en-us-broadcast" : "en-us-reference",
        label: isName ? "Broadcast English" : "American reference",
        locale: "en-US",
        ipa: null,
        respelling: null,
        notes: [
          isName
            ? "Auto-imported seed record for spoken-name coverage."
            : "Auto-imported seed record for uncommon-word coverage."
        ],
        audio: {
          ...AUDIO_TEMPLATE,
          engine_input: display
        }
      }
    ],
    related_terms: [],
    semantic_links: [],
    confusions: [],
    confusion_notes: [],
    search_rank: searchRank,
    badges: ["auto-imported"],
    source: isName ? NAME_SOURCE_META : WORD_SOURCE_META
  };
}

async function readAllSourceEntries(): Promise<unknown[]> {
  const files = await collectFiles(FIXTURE_DIR, ".json");
  const arrays = await Promise.all(files.map((filePath) => readJsonFile<unknown>(filePath)));
  return arrays.filter(Array.isArray);
}

async function readCurrentSlugs(): Promise<Set<string>> {
  const files = await collectFiles(FIXTURE_DIR, ".json");
  const slugs = new Set<string>();

  for (const filePath of files) {
    const rows = await readJsonFile<unknown[]>(filePath);

    for (const row of rows) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const candidate = row as Record<string, unknown>;
      const rawTerm =
        (typeof candidate.term === "string" && candidate.term) ||
        (typeof candidate.headword === "string" && candidate.headword) ||
        (typeof candidate.lemma === "string" && candidate.lemma) ||
        null;

      if (!rawTerm) {
        continue;
      }

      slugs.add(slugify(rawTerm));
    }
  }

  return slugs;
}

async function nextBatchIndex(): Promise<number> {
  const files = await collectFiles(FIXTURE_GENERATED_DIR, ".json").catch(() => []);
  const current = files
    .map((filePath) => path.basename(filePath).match(/wiktionary-generated-batch-(\d{3})\.json$/)?.[1])
    .filter((value): value is string => !!value)
    .map((value) => Number.parseInt(value, 10));

  return (current.length === 0 ? 0 : Math.max(...current)) + 1;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const existingRows = await readAllSourceEntries();
  const existingCount = existingRows.reduce<number>(
    (count, rows) => count + (Array.isArray(rows) ? rows.length : 0),
    0
  );
  const existingSlugs = await readCurrentSlugs();
  const remaining = options.target - existingSlugs.size;

  if (remaining <= 0) {
    console.log(`Corpus already has ${existingSlugs.size} unique entries. Nothing to generate.`);
    return;
  }

  const count = Math.min(options.count, remaining);
  const [wordListRaw, nameListRaw] = await Promise.all([
    readFile(WORD_LIST_PATH, "utf8"),
    readFile(PROPER_NAMES_PATH, "utf8")
  ]);
  const selected = pickCandidates(
    loadWordCandidates(wordListRaw, existingSlugs),
    loadNameCandidates(nameListRaw, existingSlugs),
    count
  );

  if (selected.length < count) {
    throw new Error(`Only found ${selected.length} candidates for a requested batch of ${count}.`);
  }

  const entries = writeRelatedTerms(
    selected.map((candidate, index) => buildEntry(candidate, Math.max(1, 40 - index)))
  );
  const batchIndex = await nextBatchIndex();
  const filePath = path.join(
    FIXTURE_GENERATED_DIR,
    `wiktionary-generated-batch-${String(batchIndex).padStart(3, "0")}.json`
  );

  await ensureDir(FIXTURE_GENERATED_DIR);
  await writeJsonFile(filePath, entries);

  console.log(
    JSON.stringify(
      {
        batch: batchIndex,
        generated: entries.length,
        totalRowsBefore: existingCount,
        totalUniqueEntriesAfter: existingSlugs.size + entries.length,
        file: path.relative(process.cwd(), filePath)
      },
      null,
      2
    )
  );
}

await main();
