import path from "node:path";
import { statSync, readFileSync } from "node:fs";
import YAML from "yaml";

import type { Entry } from "../../types/content";
import {
  exampleSourceSchema,
  learnIpaDrillLexiconSchema,
  lessonExampleSchema,
  symbolSourceSchema,
  unitPlanSchema,
  type LessonExample,
  type LearnIpaDrillLexicon,
  type UnitPlan
} from "../../types/learn-ipa";
import { tokenizeIpaSymbols } from "../learn-ipa/tokenize";
import { slugify } from "../slug";
import { writeJsonFile } from "./io";
import { importCmudictFile } from "./importers/cmudict";
import { importIpaDictFile } from "./importers/ipa-dict";
import { GENERATED_DIR, LEARN_IPA_SOURCES_DIR, PROJECT_ROOT } from "./paths";

const IPA_DATA_DIR = path.join(PROJECT_ROOT, "data", "ipa");
export const LEARN_IPA_DRILL_LEXICON_PATH = path.join(GENERATED_DIR, "ipa", "drill-examples.json");

export const LEARN_IPA_DRILL_SOURCE_FILES = {
  cmudict: "cmudict.dict",
  ipaDictUs: "ipa-dict-en-us.txt",
  ipaDictGb: "ipa-dict-en-gb.txt",
  commonWords: "common-words.txt",
  manifest: "manifest.json"
} as const;

const DEFAULT_MAX_DRILL_EXAMPLES = 2400;
const DEFAULT_MAX_DRILL_EXAMPLES_PER_UNIT = 72;
const IMPLICIT_DRILL_SYMBOLS = [
  "b",
  "d",
  "f",
  "h",
  "k",
  "l",
  "m",
  "n",
  "p",
  "s",
  "t",
  "v",
  "w",
  "z",
  "ɡ"
] as const;
const DRILL_GENERIC_GLOSS = "Common English word";

interface DrillSourceGroup {
  word: string;
  cmudictUs: string | null;
  ipaDictUs: string | null;
  ipaDictGb: string | null;
  ipaDictUsRawHeadword: string | null;
}

interface RankedDrillExample {
  example: LessonExample;
  score: number;
  tokens: string[];
}

function readYamlFile<T>(filePath: string): T {
  return YAML.parseDocument(readFileSync(filePath, "utf8")).toJS() as T;
}

function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function loadSymbolSources() {
  return symbolSourceSchema.array().parse(readYamlFile<unknown>(path.join(IPA_DATA_DIR, "symbols.yaml")));
}

function loadUnitPlans() {
  return unitPlanSchema.array().parse(readYamlFile<unknown>(path.join(IPA_DATA_DIR, "lesson-plan.yaml")));
}

function loadCuratedExampleWords() {
  return new Set(
    exampleSourceSchema
      .array()
      .parse(readYamlFile<unknown>(path.join(IPA_DATA_DIR, "examples.yaml")))
      .map((example) => normalizeDrillWord(example.word))
      .filter((word): word is string => !!word)
  );
}

function loadCommonWordRanks(sourceDirectory: string): Map<string, number> {
  const commonWordsPath = path.join(sourceDirectory, LEARN_IPA_DRILL_SOURCE_FILES.commonWords);
  if (!fileExists(commonWordsPath)) {
    return new Map();
  }

  return new Map(
    readFileSync(commonWordsPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((word) => /^[a-z]+$/.test(word))
      .map((word, index) => [word, index + 1] as const)
  );
}

function normalizeDrillWord(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function sanitizeIpa(raw: string): string | null {
  const candidate = raw.split(/\s*[,;]\s*/, 1)[0]?.trim() ?? "";
  const normalized = candidate
    .replace(/^[/[]+|[/\]]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/[ˈˌ.]/g, "")
    .replace(/ɫ/g, "l")
    .replace(/g/g, "ɡ")
    .replace(/r/g, "ɹ");

  if (!normalized || /[()]/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeAgreementIpa(ipa: string): string {
  return ipa
    .replace(/ɚ/g, "əɹ")
    .replace(/ɝ/g, "əɹ")
    .replace(/ɹ/g, "r");
}

function isDrillWordShape(word: string, ipaDictHeadword: string | null): boolean {
  if (!ipaDictHeadword || ipaDictHeadword !== ipaDictHeadword.toLowerCase()) {
    return false;
  }

  if (!/^[a-z]+$/.test(word)) {
    return false;
  }

  if (word.length < 3 || word.length > 12) {
    return false;
  }

  if (!/[aeiouy]/.test(word)) {
    return false;
  }

  return !/[^aeiouy]{5,}/.test(word);
}

function compareByScore(left: RankedDrillExample, right: RankedDrillExample): number {
  return (
    right.score - left.score ||
    right.example.familiarity - left.example.familiarity ||
    left.example.display.localeCompare(right.example.display)
  );
}

function countVowelGroups(word: string): number {
  return word.match(/[aeiouy]+/g)?.length ?? 0;
}

function scoreWordShape(word: string): number {
  let score = 0;
  const lengthDistance = Math.abs(word.length - 5);
  const vowelGroups = countVowelGroups(word);

  score += Math.max(0, 24 - lengthDistance * 4);
  score += word.length <= 8 ? 8 : 3;
  score += vowelGroups <= 2 ? 12 : vowelGroups <= 3 ? 8 : vowelGroups <= 4 ? 3 : 0;
  score += /[^aeiouy]{4,}/.test(word) ? 0 : 6;

  return score;
}

function buildMeaningGloss(entry: Entry | undefined): string {
  return entry?.shortGloss ?? entry?.glosses[0] ?? DRILL_GENERIC_GLOSS;
}

function buildSourceGroups(sourceDirectory: string): Promise<DrillSourceGroup[]> {
  const cmudictPath = path.join(sourceDirectory, LEARN_IPA_DRILL_SOURCE_FILES.cmudict);
  const ipaDictUsPath = path.join(sourceDirectory, LEARN_IPA_DRILL_SOURCE_FILES.ipaDictUs);
  const ipaDictGbPath = path.join(sourceDirectory, LEARN_IPA_DRILL_SOURCE_FILES.ipaDictGb);

  if (!fileExists(cmudictPath) || !fileExists(ipaDictUsPath)) {
    return Promise.resolve([]);
  }

  return Promise.all([
    importCmudictFile(cmudictPath),
    importIpaDictFile(ipaDictUsPath),
    fileExists(ipaDictGbPath) ? importIpaDictFile(ipaDictGbPath) : Promise.resolve([])
  ]).then(([cmudictEntries, ipaDictUsEntries, ipaDictGbEntries]) => {
    const groups = new Map<string, DrillSourceGroup>();

    for (const entry of cmudictEntries) {
      const word = normalizeDrillWord(entry.headword);
      const ipa = sanitizeIpa(entry.ipa);

      if (!word || !ipa) {
        continue;
      }

      const current = groups.get(word) ?? {
        word,
        cmudictUs: null,
        ipaDictUs: null,
        ipaDictGb: null,
        ipaDictUsRawHeadword: null
      };

      current.cmudictUs ??= ipa;
      groups.set(word, current);
    }

    for (const entry of ipaDictUsEntries) {
      const word = normalizeDrillWord(entry.headword);
      const ipa = sanitizeIpa(entry.ipa);

      if (!word || !ipa) {
        continue;
      }

      const current = groups.get(word) ?? {
        word,
        cmudictUs: null,
        ipaDictUs: null,
        ipaDictGb: null,
        ipaDictUsRawHeadword: null
      };

      current.ipaDictUs ??= ipa;
      current.ipaDictUsRawHeadword ??= entry.headword;
      groups.set(word, current);
    }

    for (const entry of ipaDictGbEntries) {
      const word = normalizeDrillWord(entry.headword);
      const ipa = sanitizeIpa(entry.ipa);

      if (!word || !ipa) {
        continue;
      }

      const current = groups.get(word) ?? {
        word,
        cmudictUs: null,
        ipaDictUs: null,
        ipaDictGb: null,
        ipaDictUsRawHeadword: null
      };

      current.ipaDictGb ??= ipa;
      groups.set(word, current);
    }

    return [...groups.values()];
  });
}

function buildRankedDrillExamples(
  entries: Entry[],
  sourceGroups: DrillSourceGroup[],
  commonWordRanks: Map<string, number>,
  maxExamples = DEFAULT_MAX_DRILL_EXAMPLES
): RankedDrillExample[] {
  const symbolSources = loadSymbolSources();
  const knownSymbols = [...new Set([...symbolSources.map((symbol) => symbol.symbol), ...IMPLICIT_DRILL_SYMBOLS])];
  const supportedSymbols = new Set(knownSymbols);
  const courseSymbols = new Set(symbolSources.map((symbol) => symbol.symbol));
  const curatedWords = loadCuratedExampleWords();
  const corpusBySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const capitalizedCorpusSlugs = new Set(
    entries
      .filter((entry) => entry.display !== entry.display.toLowerCase())
      .map((entry) => entry.slug)
  );
  const strongMatches: RankedDrillExample[] = [];
  const fallbackMatches: RankedDrillExample[] = [];

  for (const group of sourceGroups) {
    if (!group.cmudictUs || !group.ipaDictUs) {
      continue;
    }

    if (curatedWords.has(group.word) || !isDrillWordShape(group.word, group.ipaDictUsRawHeadword)) {
      continue;
    }

    const tokens = tokenizeIpaSymbols(group.cmudictUs, knownSymbols);
    if (tokens.length === 0 || tokens.some((token) => !supportedSymbols.has(token))) {
      continue;
    }

    const focusSymbols = [...new Set(tokens.filter((token) => courseSymbols.has(token)))];
    if (focusSymbols.length === 0) {
      continue;
    }

    const slug = slugify(group.word);
    const corpusEntry = corpusBySlug.get(slug);
    const looksLikeName = capitalizedCorpusSlugs.has(slug);
    const exactAgreement = normalizeAgreementIpa(group.cmudictUs) === normalizeAgreementIpa(group.ipaDictUs);
    const commonWordRank = commonWordRanks.get(group.word) ?? null;
    const score =
      36 +
      scoreWordShape(group.word) +
      (exactAgreement ? 22 : 0) +
      (group.ipaDictGb ? 8 : 0) +
      (corpusEntry ? 6 : 0) +
      (focusSymbols.length > 1 ? 4 : 0) +
      (commonWordRank ? Math.max(0, 240 - Math.round(commonWordRank / 50)) : -40) -
      (looksLikeName ? 60 : 0);
    const familiarity = Math.max(0.25, Math.min(0.99, score / 100));
    const example = lessonExampleSchema.parse({
      id: `drill-${slug}`,
      word: group.word,
      display: group.word,
      ipa: {
        "en-US": group.cmudictUs
      },
      focusSymbols,
      familiarity,
      wordType: "common-word",
      originLanguage: "English",
      corpusSlug: corpusEntry?.slug ?? null,
      meaningGloss: buildMeaningGloss(corpusEntry),
      audio: {
        "en-US": {
          src: null,
          speechText: group.word,
          accent: "en-US"
        },
        "en-GB": {
          src: null,
          speechText: group.word,
          accent: "en-GB"
        }
      }
    });
    const ranked = { example, score, tokens };

    if (exactAgreement) {
      strongMatches.push(ranked);
    } else {
      fallbackMatches.push(ranked);
    }
  }

  return [...strongMatches.sort(compareByScore), ...fallbackMatches.sort(compareByScore)].slice(0, maxExamples);
}

function extractTaughtSymbols(unit: UnitPlan, symbolById: Map<string, string>): string[] {
  return unit.teach
    .filter((teach) => teach.type === "symbol")
    .map((teach) => symbolById.get(teach.id) ?? teach.id);
}

function pickBalancedDrillIds(
  candidates: RankedDrillExample[],
  targetSymbols: string[],
  limit: number
): string[] {
  const seen = new Set<string>();
  const picks: string[] = [];
  const buckets = targetSymbols.map((symbol) =>
    candidates.filter((candidate) => candidate.example.focusSymbols.includes(symbol))
  );

  let progressed = true;
  while (picks.length < limit && progressed) {
    progressed = false;

    for (const bucket of buckets) {
      const next = bucket.find((candidate) => !seen.has(candidate.example.id));
      if (!next) {
        continue;
      }

      seen.add(next.example.id);
      picks.push(next.example.id);
      progressed = true;

      if (picks.length >= limit) {
        return picks;
      }
    }
  }

  for (const candidate of candidates) {
    if (seen.has(candidate.example.id)) {
      continue;
    }

    seen.add(candidate.example.id);
    picks.push(candidate.example.id);

    if (picks.length >= limit) {
      break;
    }
  }

  return picks;
}

function scoreCandidateForUnit(candidate: RankedDrillExample, targetSymbols: string[]): number {
  const targetHits = candidate.example.focusSymbols.filter((symbol) => targetSymbols.includes(symbol)).length;
  const extraFocus = candidate.example.focusSymbols.filter((symbol) => !targetSymbols.includes(symbol)).length;
  const cleanTargetWord =
    candidate.example.focusSymbols.length > 0 &&
    candidate.example.focusSymbols.every((symbol) => targetSymbols.includes(symbol));

  return (
    candidate.score +
    targetHits * 28 +
    (cleanTargetWord ? 24 : 0) -
    extraFocus * 18 -
    candidate.example.display.length * 2 -
    Math.max(0, candidate.tokens.length - 4) * 5
  );
}

export function buildLearnIpaDrillAssignments(
  drillExamples: LessonExample[],
  options?: { maxExamplesPerUnit?: number }
): Map<string, string[]> {
  if (drillExamples.length === 0) {
    return new Map();
  }

  const maxExamplesPerUnit = options?.maxExamplesPerUnit ?? DEFAULT_MAX_DRILL_EXAMPLES_PER_UNIT;
  const symbolSources = loadSymbolSources();
  const unitPlans = loadUnitPlans();
  const knownSymbols = [...new Set([...symbolSources.map((symbol) => symbol.symbol), ...IMPLICIT_DRILL_SYMBOLS])];
  const symbolById = new Map(symbolSources.map((symbol) => [symbol.id, symbol.symbol]));
  const rankedExamples = drillExamples.map((example) => ({
    example,
    score: example.familiarity * 100,
    tokens: tokenizeIpaSymbols(example.ipa["en-US"] ?? "", knownSymbols)
  }));
  const assignments = new Map<string, string[]>();
  const introducedSymbols = new Set<string>(IMPLICIT_DRILL_SYMBOLS);
  const taughtCourseSymbols = new Set<string>();

  for (const unit of unitPlans) {
    const targetSymbols = extractTaughtSymbols(unit, symbolById);

    for (const symbol of targetSymbols) {
      introducedSymbols.add(symbol);
      taughtCourseSymbols.add(symbol);
    }

    if (targetSymbols.length === 0) {
      assignments.set(unit.id, []);
      continue;
    }

    const complexityLimit =
      taughtCourseSymbols.size <= 3
        ? { minLetters: 4, maxLetters: 5, maxTokens: 4 }
        : taughtCourseSymbols.size <= 5
          ? { minLetters: 4, maxLetters: 6, maxTokens: 6 }
          : taughtCourseSymbols.size <= 10
            ? { minLetters: 3, maxLetters: 7, maxTokens: 6 }
            : { minLetters: 3, maxLetters: 9, maxTokens: 8 };

    const candidates = rankedExamples
      .filter(
        (candidate) =>
          candidate.tokens.every((token) => introducedSymbols.has(token)) &&
          candidate.example.focusSymbols.some((symbol) => targetSymbols.includes(symbol)) &&
          candidate.example.display.length >= complexityLimit.minLetters &&
          candidate.example.display.length <= complexityLimit.maxLetters &&
          candidate.tokens.length <= complexityLimit.maxTokens
      )
      .sort(
        (left, right) =>
          scoreCandidateForUnit(right, targetSymbols) - scoreCandidateForUnit(left, targetSymbols) ||
          compareByScore(left, right)
      );

    assignments.set(unit.id, pickBalancedDrillIds(candidates, targetSymbols, maxExamplesPerUnit));
  }

  return assignments;
}

export async function buildLearnIpaDrillLexicon(
  entries: Entry[],
  options?: { sourceDirectory?: string; maxExamples?: number }
): Promise<LearnIpaDrillLexicon> {
  const sourceDirectory = options?.sourceDirectory ?? LEARN_IPA_SOURCES_DIR;
  const commonWordRanks = loadCommonWordRanks(sourceDirectory);
  const rankedExamples = buildRankedDrillExamples(
    entries,
    await buildSourceGroups(sourceDirectory),
    commonWordRanks,
    options?.maxExamples ?? DEFAULT_MAX_DRILL_EXAMPLES
  );

  return learnIpaDrillLexiconSchema.parse({
    generatedAt: new Date().toISOString(),
    version: 1,
    examples: rankedExamples.map((candidate) => candidate.example)
  });
}

export async function writeLearnIpaDrillLexicon(
  entries: Entry[],
  options?: { sourceDirectory?: string; maxExamples?: number }
): Promise<LearnIpaDrillLexicon> {
  const lexicon = await buildLearnIpaDrillLexicon(entries, options);
  await writeJsonFile(LEARN_IPA_DRILL_LEXICON_PATH, lexicon);
  return lexicon;
}
