import path from "node:path";
import { readFileSync } from "node:fs";
import matter from "gray-matter";
import YAML from "yaml";

import { markdownToHtml } from "../merge";
import { slugify } from "../slug";
import { uniqueIpaSymbols } from "../learn-ipa/tokenize";
import { buildLearnIpaDrillAssignments } from "./learn-ipa-drills";
import {
  conceptFrontmatterSchema,
  conceptRuntimeSchema,
  exampleSourceSchema,
  learnCurriculumSchema,
  lessonExampleSchema,
  moduleFrontmatterSchema,
  reviewCardSchema,
  symbolRuntimeSchema,
  symbolSourceSchema,
  unitPlanSchema,
  type LessonExample,
  type UnitPlan,
  type LearnCurriculum,
  type LearnIpaDrillLexicon
} from "../../types/learn-ipa";
import type { Entry } from "../../types/content";
import { collectFiles, readTextFile, writeJsonFile } from "./io";
import { GENERATED_DIR, PROJECT_ROOT } from "./paths";

const IPA_DATA_DIR = path.join(PROJECT_ROOT, "data", "ipa");
const IPA_CONTENT_DIR = path.join(PROJECT_ROOT, "content", "ipa");
export const LEARN_IPA_GENERATED_DIR = path.join(GENERATED_DIR, "ipa");
export const LEARN_IPA_CURRICULUM_PATH = path.join(LEARN_IPA_GENERATED_DIR, "curriculum.json");
export const LEARN_IPA_LOOKUP_PATH = path.join(LEARN_IPA_GENERATED_DIR, "lookup.json");

function readYamlFile<T>(filePath: string): T {
  return YAML.parseDocument(readFileSyncUtf8(filePath)).toJS() as T;
}

function readFileSyncUtf8(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

async function loadMarkdownMap<T extends { id: string }>(
  directory: string,
  schema: { parse(value: unknown): T }
): Promise<Map<string, T & { bodyHtml: string }>> {
  const files = await collectFiles(directory, ".md");
  const records = new Map<string, T & { bodyHtml: string }>();

  for (const filePath of files) {
    const raw = await readTextFile(filePath);
    const parsed = matter(raw);
    const frontmatter = schema.parse(parsed.data);
    records.set(frontmatter.id, {
      ...frontmatter,
      bodyHtml: markdownToHtml(parsed.content)
    });
  }

  return records;
}

function buildExampleRuntime(example: unknown, corpusBySlug: Map<string, Entry>) {
  const parsed = exampleSourceSchema.parse(example);
  const corpusEntry = parsed.corpus_slug ? corpusBySlug.get(parsed.corpus_slug) : null;
  const audio = new Map<string, { src: string | null; speechText: string | null; accent: string }>();

  for (const accent of new Set([...Object.keys(parsed.ipa), ...Object.keys(parsed.audio), ...Object.keys(parsed.audio_text)])) {
    const matchingVariant =
      corpusEntry?.variants.find((variant) => variant.locale.toLowerCase() === accent.toLowerCase()) ??
      corpusEntry?.variants.find((variant) => variant.locale.toLowerCase().startsWith(accent.toLowerCase().split("-")[0]));

    audio.set(accent, {
      src: parsed.audio[accent] ?? matchingVariant?.audio.src ?? null,
      speechText: parsed.audio_text[accent] ?? matchingVariant?.respelling ?? parsed.display,
      accent
    });
  }

  return lessonExampleSchema.parse({
    id: parsed.id,
    word: parsed.word,
    display: parsed.display,
    ipa: parsed.ipa,
    focusSymbols: parsed.focus_symbols,
    familiarity: parsed.familiarity,
    wordType: parsed.word_type,
    originLanguage: parsed.origin_language,
    corpusSlug: parsed.corpus_slug ?? null,
    meaningGloss: parsed.meaning_gloss,
    audio: Object.fromEntries(audio)
  });
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function createReviewCards(unit: ReturnType<typeof unitPlanSchema.parse>) {
  const cards = [];

  for (const [index, teach] of unit.teach.entries()) {
    cards.push(
      reviewCardSchema.parse({
        id: `card:${unit.id}:${teach.type}:${teach.id}`,
        kind: teach.type === "symbol" ? "symbol" : "concept",
        prompt:
          teach.type === "symbol"
            ? `Recall the sound and role of ${teach.id}.`
            : `Recall the idea behind ${teach.id}.`,
        symbolId: teach.type === "symbol" ? teach.id : null,
        conceptId: teach.type === "concept" ? teach.id : null,
        exampleId: null,
        relatedStepId: `${unit.id}-s${index + 1}`
      })
    );
  }

  for (const exampleId of unit.practice_examples.slice(0, 2)) {
    cards.push(
      reviewCardSchema.parse({
        id: `card:${unit.id}:example:${exampleId}`,
        kind: "example",
        prompt: `Decode or recognize ${exampleId}.`,
        symbolId: null,
        conceptId: null,
        exampleId,
        relatedStepId: `${unit.id}-s4`
      })
    );
  }

  return cards;
}

function pickTeachExampleIds(
  unit: UnitPlan,
  itemId: string,
  exampleById: Map<string, LessonExample>
): string[] {
  const matchingExamples = unit.practice_examples.filter((exampleId) => {
    const example = exampleById.get(exampleId);
    return example ? example.focusSymbols.includes(itemId) : false;
  });

  return (matchingExamples.length > 0 ? matchingExamples : unit.practice_examples).slice(0, 3);
}

function buildUnitSteps(unit: UnitPlan, unitIndex: number, exampleById: Map<string, LessonExample>) {
  const teachSteps = unit.teach.map((teach, offset) => {
    const base = {
      id: `${unit.id}-s${offset + 1}`,
      moduleId: unit.module_id,
      unitId: unit.id,
      title: unit.title,
      objective: unit.summary
    };

    if (teach.type === "symbol") {
      return {
        ...base,
        type: "teach-symbol" as const,
        symbolId: teach.id,
        exampleIds: pickTeachExampleIds(unit, teach.id, exampleById)
      };
    }

    return {
      ...base,
      type: "teach-concept" as const,
      conceptId: teach.id,
      exampleIds: unit.practice_examples.slice(0, 3)
    };
  });

  const skillStep =
    unitIndex % 2 === 0
      ? {
          id: `${unit.id}-s4`,
          moduleId: unit.module_id,
          unitId: unit.id,
          title: `${unit.title} listening check`,
          objective: "Hear the target and match it to the right IPA.",
          type: "listen-match" as const,
          promptExampleId: unit.practice_examples[0],
          choiceExampleIds: unit.practice_examples.slice(0, 3)
        }
      : {
          id: `${unit.id}-s4`,
          moduleId: unit.module_id,
          unitId: unit.id,
          title: `${unit.title} decoding practice`,
          objective: "Decode real words with the new symbols while the pattern is still fresh.",
          type: "decode-word" as const,
          exampleIds: unit.practice_examples.slice(0, 3)
        };

  const bonusStep = {
    id: `${unit.id}-s5`,
    moduleId: unit.module_id,
    unitId: unit.id,
    title: `${unit.title} bonus round`,
    objective: "Drill the pattern across a wider word set until the reading feels more automatic.",
    type: "bonus-round" as const,
    exampleIds: uniqueValues([
      ...(unit.drill_examples.length > 0 ? unit.drill_examples : unit.bonus_examples),
      ...unit.bonus_examples,
      ...unit.practice_examples
    ]).filter((exampleId) => exampleById.has(exampleId)),
    drillExampleIds: [] as string[]
  };

  const reviewStep = {
    id: `${unit.id}-s6`,
    moduleId: unit.module_id,
    unitId: unit.id,
    title: `${unit.title} review`,
    objective: "Mix the new material with older symbols and examples.",
    type: "review-round" as const,
    reviewCardIds: [
      ...unit.teach.map((teach) => `card:${unit.id}:${teach.type}:${teach.id}`),
      ...unit.practice_examples.slice(0, 2).map((exampleId) => `card:${unit.id}:example:${exampleId}`)
    ],
    fallbackExampleIds: unit.practice_examples.slice(0, 4)
  };

  return [...teachSteps, skillStep, bonusStep, reviewStep];
}

function buildRelatedWordLinks(entries: Entry[], knownSymbols: string[]): Record<string, string[]> {
  const sortedEntries = [...entries].sort(
    (left, right) => right.qualityScore - left.qualityScore || left.display.localeCompare(right.display)
  );
  const related = new Map<string, string[]>();

  for (const entry of sortedEntries) {
    const tokens = uniqueIpaSymbols(
      entry.variants.map((variant) => variant.ipa),
      knownSymbols
    );

    for (const token of tokens) {
      const current = related.get(token) ?? [];
      if (!current.includes(entry.slug)) {
        current.push(entry.slug);
      }
      related.set(token, current.slice(0, 8));
    }
  }

  return Object.fromEntries(related);
}

function assertMissing(kind: string, id: string, container: string): never {
  throw new Error(`Learn IPA ${kind} "${id}" is referenced but missing from ${container}.`);
}

function validateCurriculumReferences(
  unitPlans: UnitPlan[],
  symbolIds: Set<string>,
  exampleIds: Set<string>,
  moduleIds: Set<string>,
  conceptIds: Set<string>
): void {
  for (const unit of unitPlans) {
    if (!moduleIds.has(unit.module_id)) {
      assertMissing("module", unit.module_id, "content/ipa/modules");
    }

    for (const exampleId of [...unit.practice_examples, ...unit.bonus_examples, ...unit.drill_examples]) {
      if (!exampleIds.has(exampleId)) {
        assertMissing("example", exampleId, "data/ipa/examples.yaml");
      }
    }

    for (const teach of unit.teach) {
      if (teach.type === "symbol" && !symbolIds.has(teach.id)) {
        assertMissing("symbol", teach.id, "data/ipa/symbols.yaml");
      }

      if (teach.type === "concept" && !conceptIds.has(teach.id)) {
        assertMissing("concept", teach.id, "content/ipa/concepts");
      }
    }
  }
}

export async function buildLearnIpaCurriculum(
  entries: Entry[],
  drillLexicon?: LearnIpaDrillLexicon | null
): Promise<LearnCurriculum> {
  const corpusBySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const symbolSources = symbolSourceSchema.array().parse(
    readYamlFile<unknown>(path.join(IPA_DATA_DIR, "symbols.yaml"))
  );
  const exampleSources = exampleSourceSchema.array().parse(
    readYamlFile<unknown>(path.join(IPA_DATA_DIR, "examples.yaml"))
  );
  const unitPlans = unitPlanSchema.array().parse(
    readYamlFile<unknown>(path.join(IPA_DATA_DIR, "lesson-plan.yaml"))
  );
  const moduleMap = await loadMarkdownMap(path.join(IPA_CONTENT_DIR, "modules"), moduleFrontmatterSchema);
  const conceptMap = await loadMarkdownMap(path.join(IPA_CONTENT_DIR, "concepts"), conceptFrontmatterSchema);

  validateCurriculumReferences(
    unitPlans,
    new Set(symbolSources.map((symbol) => symbol.id)),
    new Set(exampleSources.map((example) => example.id)),
    new Set(moduleMap.keys()),
    new Set(conceptMap.keys())
  );

  const knownSymbols = symbolSources.map((symbol) => symbol.symbol);
  const examples = exampleSources.map((example) => buildExampleRuntime(example, corpusBySlug));
  const exampleById = new Map(examples.map((example) => [example.id, example]));
  const steps = unitPlans.flatMap((unit, index) => buildUnitSteps(unit, index + 1, exampleById));
  const reviewCards = unitPlans.flatMap((unit) => createReviewCards(unit));
  const drillAssignments = buildLearnIpaDrillAssignments(drillLexicon?.examples ?? []);
  const symbolToStep: Record<string, string> = {};

  for (const step of steps) {
    if (step.type === "bonus-round") {
      step.drillExampleIds = drillAssignments.get(step.unitId) ?? [];
    }
  }

  for (const step of steps) {
    if (step.type === "teach-symbol" && !symbolToStep[step.symbolId]) {
      const symbol = symbolSources.find((source) => source.id === step.symbolId);
      if (symbol) {
        symbolToStep[symbol.symbol] = step.id;
        if (symbol.id !== symbol.symbol) {
          symbolToStep[symbol.id] = step.id;
        }
      }
    }
  }

  const modules = [...moduleMap.values()].map((module) => {
    const unitIds = module.unit_ids;
    const moduleSteps = steps.filter((step) => step.moduleId === module.id);
    const symbolIds = [
      ...new Set(
        unitPlans
          .filter((unit) => unit.module_id === module.id)
          .flatMap((unit) => unit.teach.filter((teach) => teach.type === "symbol").map((teach) => teach.id))
      )
    ];
    const conceptIds = [
      ...new Set(
        unitPlans
          .filter((unit) => unit.module_id === module.id)
          .flatMap((unit) => unit.teach.filter((teach) => teach.type === "concept").map((teach) => teach.id))
      )
    ];

    return {
      id: module.id,
      slug: module.id,
      title: module.title,
      summary: module.summary,
      bodyHtml: module.bodyHtml,
      unitIds,
      stepIds: moduleSteps.map((step) => step.id),
      symbolIds,
      conceptIds
    };
  });

  const concepts = [...conceptMap.values()].map((concept) =>
    conceptRuntimeSchema.parse({
      id: concept.id,
      title: concept.title,
      summary: concept.summary,
      bodyHtml: concept.bodyHtml
    })
  );

  const relatedWordLinks = buildRelatedWordLinks(entries, knownSymbols);
  const symbols = symbolSources.map((symbol) =>
    symbolRuntimeSchema.parse({
      id: symbol.id,
      symbol: symbol.symbol,
      name: symbol.name,
      class: symbol.class,
      required: symbol.required,
      notes: symbol.notes,
      difficulty: symbol.difficulty,
      confusionScore: symbol.confusion_score,
      prerequisites: symbol.prerequisites,
      exampleIds: examples
        .filter((example) => example.focusSymbols.includes(symbol.symbol))
        .map((example) => example.id)
        .slice(0, 8),
      firstStepId: symbolToStep[symbol.symbol] ?? null,
      relatedWordSlugs: relatedWordLinks[symbol.symbol] ?? []
    })
  );

  const curriculum = learnCurriculumSchema.parse({
    generatedAt: new Date().toISOString(),
    version: 1,
    modules,
    concepts,
    symbols,
    examples,
    steps,
    reviewCards,
    symbolToStep,
    relatedWordLinks
  });

  return curriculum;
}

export async function writeLearnIpaCurriculum(
  entries: Entry[],
  drillLexicon?: LearnIpaDrillLexicon | null
): Promise<LearnCurriculum> {
  const curriculum = await buildLearnIpaCurriculum(entries, drillLexicon);
  await writeJsonFile(LEARN_IPA_CURRICULUM_PATH, curriculum);
  return curriculum;
}
