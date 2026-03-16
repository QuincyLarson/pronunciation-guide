import { z } from "zod";

import {
  MIN_INDEXABLE_ENTRIES_PER_HUB,
  MIN_USEFULNESS_SCORE_FOR_CORE,
  MIN_USEFULNESS_SCORE_FOR_INDEXING
} from "../lib/constants";

export const indexStageSchema = z.enum(["candidate", "indexable"]);
export const indexTierSchema = z.enum(["candidate", "expanded", "core"]);
export const promotionTierSchema = z.enum(["expanded", "core"]);
export const graduationRuleSourceSchema = z.enum(["manual", "search-console"]);

export const graduationPromotionSchema = z.object({
  slug: z.string(),
  tier: promotionTierSchema.default("expanded"),
  reason: z.string(),
  source: graduationRuleSourceSchema.default("manual")
});

export const graduationSuppressionSchema = z.object({
  slug: z.string(),
  reason: z.string(),
  source: graduationRuleSourceSchema.default("manual")
});

export const searchConsolePromotionSchema = z.object({
  slug: z.string(),
  impressions: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  ctr: z.number().min(0).max(1).default(0),
  position: z.number().nonnegative().default(0),
  tier: promotionTierSchema.default("expanded"),
  reason: z.string()
});

export const graduationRulesSchema = z.object({
  metadataThresholds: z
    .object({
      minUsefulnessScoreForIndexing: z
        .number()
        .min(0)
        .max(100)
        .default(MIN_USEFULNESS_SCORE_FOR_INDEXING),
      minUsefulnessScoreForCore: z.number().min(0).max(100).default(MIN_USEFULNESS_SCORE_FOR_CORE),
      minIndexableEntriesPerHub: z.number().int().min(1).default(MIN_INDEXABLE_ENTRIES_PER_HUB)
    })
    .default({
      minUsefulnessScoreForIndexing: MIN_USEFULNESS_SCORE_FOR_INDEXING,
      minUsefulnessScoreForCore: MIN_USEFULNESS_SCORE_FOR_CORE,
      minIndexableEntriesPerHub: MIN_INDEXABLE_ENTRIES_PER_HUB
    }),
  manual: z
    .object({
      promote: z.array(graduationPromotionSchema).default([]),
      suppress: z.array(graduationSuppressionSchema).default([])
    })
    .default({
      promote: [],
      suppress: []
    }),
  searchConsole: z
    .object({
      promote: z.array(searchConsolePromotionSchema).default([]),
      suppress: z.array(graduationSuppressionSchema).default([])
    })
    .default({
      promote: [],
      suppress: []
    })
});

export const graduationManifestEntrySchema = z.object({
  slug: z.string(),
  display: z.string(),
  stage: indexStageSchema,
  tier: indexTierSchema,
  usefulnessScore: z.number().min(0).max(100),
  reasons: z.array(z.string()).default([]),
  signals: z.array(z.string()).default([])
});

export const graduationManifestSchema = z.object({
  generatedAt: z.string(),
  thresholds: graduationRulesSchema.shape.metadataThresholds,
  counts: z.object({
    candidate: z.number().int().nonnegative(),
    indexable: z.number().int().nonnegative(),
    core: z.number().int().nonnegative(),
    expanded: z.number().int().nonnegative()
  }),
  promoted: z.array(graduationManifestEntrySchema).default([]),
  candidates: z.array(graduationManifestEntrySchema).default([]),
  manualPromotions: z.array(graduationPromotionSchema).default([]),
  searchConsolePromotions: z.array(searchConsolePromotionSchema).default([]),
  suppressions: z.array(graduationSuppressionSchema).default([])
});

export type IndexStage = z.infer<typeof indexStageSchema>;
export type IndexTier = z.infer<typeof indexTierSchema>;
export type PromotionTier = z.infer<typeof promotionTierSchema>;
export type GraduationPromotion = z.infer<typeof graduationPromotionSchema>;
export type GraduationSuppression = z.infer<typeof graduationSuppressionSchema>;
export type SearchConsolePromotion = z.infer<typeof searchConsolePromotionSchema>;
export type GraduationRules = z.infer<typeof graduationRulesSchema>;
export type GraduationManifest = z.infer<typeof graduationManifestSchema>;
