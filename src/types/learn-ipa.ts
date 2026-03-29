import { z } from "zod";

export const teachableItemTypeSchema = z.enum(["symbol", "concept"]);
export const symbolClassSchema = z.enum(["vowel", "consonant", "mark", "conceptual-mark", "cluster"]);
export const exampleWordTypeSchema = z.enum([
  "common-word",
  "loanword",
  "proper-noun",
  "name",
  "concept-example"
]);
export const stepTypeSchema = z.enum([
  "teach-symbol",
  "teach-concept",
  "decode-word",
  "listen-match",
  "bonus-round",
  "review-round",
  "mic-check"
]);
export const reviewOutcomeSchema = z.enum(["failed", "hard", "good", "easy"]);

export const symbolSourceSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  class: symbolClassSchema,
  teach_explicitly: z.boolean().default(true),
  required: z.boolean().default(true),
  prerequisites: z.array(z.string()).default([]),
  concepts: z.array(z.string()).default([]),
  english_examples: z.array(z.string()).default([]),
  loanword_examples: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  difficulty: z.number().min(0).max(1),
  confusion_score: z.number().min(0).max(1)
});

export const exampleSourceSchema = z.object({
  id: z.string(),
  word: z.string(),
  display: z.string(),
  ipa: z.record(z.string(), z.string()),
  focus_symbols: z.array(z.string()).default([]),
  familiarity: z.number().min(0).max(1),
  word_type: exampleWordTypeSchema,
  origin_language: z.string(),
  corpus_slug: z.string().optional(),
  audio: z.record(z.string(), z.string()).default({}),
  audio_text: z.record(z.string(), z.string()).default({}),
  meaning_gloss: z.string()
});

export const teachItemSourceSchema = z.object({
  type: teachableItemTypeSchema,
  id: z.string()
});

export const unitPlanSchema = z.object({
  id: z.string(),
  module_id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  teach: z.array(teachItemSourceSchema).length(3),
  practice_examples: z.array(z.string()).min(3),
  bonus_examples: z.array(z.string()).min(4),
  drill_examples: z.array(z.string()).default([]),
  review_focus: z.array(z.string()).default([]),
  capstone_word_slugs: z.array(z.string()).default([])
});

export const moduleFrontmatterSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  unit_ids: z.array(z.string()).min(1)
});

export const conceptFrontmatterSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string()
});

export const lessonAudioSchema = z.object({
  src: z.string().nullable().default(null),
  speechText: z.string().nullable().default(null),
  accent: z.string().default("en-US")
});

export const lessonExampleSchema = z.object({
  id: z.string(),
  word: z.string(),
  display: z.string(),
  ipa: z.record(z.string(), z.string()),
  focusSymbols: z.array(z.string()).default([]),
  familiarity: z.number().min(0).max(1),
  wordType: exampleWordTypeSchema,
  originLanguage: z.string(),
  corpusSlug: z.string().nullable().default(null),
  meaningGloss: z.string(),
  audio: z.record(z.string(), lessonAudioSchema).default({})
});

export const moduleSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  bodyHtml: z.string(),
  unitIds: z.array(z.string()),
  stepIds: z.array(z.string()),
  symbolIds: z.array(z.string()),
  conceptIds: z.array(z.string())
});

export const conceptRuntimeSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  bodyHtml: z.string()
});

export const symbolRuntimeSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  class: symbolClassSchema,
  required: z.boolean(),
  notes: z.array(z.string()).default([]),
  difficulty: z.number().min(0).max(1),
  confusionScore: z.number().min(0).max(1),
  prerequisites: z.array(z.string()).default([]),
  exampleIds: z.array(z.string()).default([]),
  firstStepId: z.string().nullable().default(null),
  relatedWordSlugs: z.array(z.string()).default([])
});

export const teachSymbolStepSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  unitId: z.string(),
  title: z.string(),
  objective: z.string(),
  type: z.literal("teach-symbol"),
  symbolId: z.string(),
  exampleIds: z.array(z.string()).min(1)
});

export const teachConceptStepSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  unitId: z.string(),
  title: z.string(),
  objective: z.string(),
  type: z.literal("teach-concept"),
  conceptId: z.string(),
  exampleIds: z.array(z.string()).default([])
});

export const decodeWordStepSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  unitId: z.string(),
  title: z.string(),
  objective: z.string(),
  type: z.literal("decode-word"),
  exampleIds: z.array(z.string()).min(3)
});

export const listenMatchChoiceSchema = z.object({
  exampleId: z.string(),
  ipa: z.string()
});

export const listenMatchStepSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  unitId: z.string(),
  title: z.string(),
  objective: z.string(),
  type: z.literal("listen-match"),
  promptExampleId: z.string(),
  choiceExampleIds: z.array(z.string()).min(2)
});

export const bonusRoundStepSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  unitId: z.string(),
  title: z.string(),
  objective: z.string(),
  type: z.literal("bonus-round"),
  exampleIds: z.array(z.string()).min(4)
});

export const reviewRoundStepSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  unitId: z.string(),
  title: z.string(),
  objective: z.string(),
  type: z.literal("review-round"),
  reviewCardIds: z.array(z.string()).min(1),
  fallbackExampleIds: z.array(z.string()).default([])
});

export const micCheckStepSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  unitId: z.string(),
  title: z.string(),
  objective: z.string(),
  type: z.literal("mic-check"),
  exampleId: z.string()
});

export const learnStepSchema = z.discriminatedUnion("type", [
  teachSymbolStepSchema,
  teachConceptStepSchema,
  decodeWordStepSchema,
  listenMatchStepSchema,
  bonusRoundStepSchema,
  reviewRoundStepSchema,
  micCheckStepSchema
]);

export const reviewCardSchema = z.object({
  id: z.string(),
  kind: z.enum(["symbol", "concept", "contrast", "example"]),
  prompt: z.string(),
  symbolId: z.string().nullable().default(null),
  conceptId: z.string().nullable().default(null),
  exampleId: z.string().nullable().default(null),
  relatedStepId: z.string().nullable().default(null)
});

export const learnCurriculumSchema = z.object({
  generatedAt: z.string(),
  version: z.number().int(),
  modules: z.array(moduleSummarySchema),
  concepts: z.array(conceptRuntimeSchema),
  symbols: z.array(symbolRuntimeSchema),
  examples: z.array(lessonExampleSchema),
  steps: z.array(learnStepSchema),
  reviewCards: z.array(reviewCardSchema),
  symbolToStep: z.record(z.string(), z.string()),
  relatedWordLinks: z.record(z.string(), z.array(z.string()))
});

export const learnIpaStateSchema = z.object({
  version: z.number().int(),
  currentStepId: z.string().nullable(),
  completedStepIds: z.array(z.string()).default([]),
  unlockedModuleIds: z.array(z.string()).default([]),
  lessonAttempts: z.record(
    z.string(),
    z.object({
      attempts: z.number().int(),
      correct: z.number().int(),
      lastSeenAt: z.string()
    })
  ),
  symbolStats: z.record(
    z.string(),
    z.object({
      introduced: z.boolean(),
      confidence: z.number().min(0).max(1),
      dueAt: z.string().nullable(),
      intervalDays: z.number(),
      ease: z.number(),
      lapses: z.number().int(),
      successes: z.number().int()
    })
  ),
  reviewQueue: z.array(z.string()).default([]),
  settings: z.object({
    accent: z.enum(["en-US", "en-GB"]).default("en-US"),
    reducedMotion: z.boolean().default(false),
    autoplayAfterGesture: z.boolean().default(true),
    micMode: z.enum(["off", "record-only", "experimental-score"]).default("off"),
    playbackRateDefault: z.union([z.literal(1), z.literal(0.5)]).default(1)
  }),
  streak: z.object({
    currentDays: z.number().int(),
    lastStudyDate: z.string().nullable()
  })
});

export type SymbolSource = z.infer<typeof symbolSourceSchema>;
export type ExampleSource = z.infer<typeof exampleSourceSchema>;
export type UnitPlan = z.infer<typeof unitPlanSchema>;
export type ModuleFrontmatter = z.infer<typeof moduleFrontmatterSchema>;
export type ConceptFrontmatter = z.infer<typeof conceptFrontmatterSchema>;
export type ModuleSummary = z.infer<typeof moduleSummarySchema>;
export type LessonExample = z.infer<typeof lessonExampleSchema>;
export type LearnStep = z.infer<typeof learnStepSchema>;
export type ReviewCard = z.infer<typeof reviewCardSchema>;
export type LearnCurriculum = z.infer<typeof learnCurriculumSchema>;
export type LearnIpaState = z.infer<typeof learnIpaStateSchema>;
export type ReviewOutcome = z.infer<typeof reviewOutcomeSchema>;
