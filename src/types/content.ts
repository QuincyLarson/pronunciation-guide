import { z } from "zod";

export const reviewStatusSchema = z.enum([
  "auto-imported",
  "human-edited",
  "native-reviewed",
  "editor-approved",
  "needs-source-check",
  "license-review-needed",
  "reviewed",
  "unreviewed"
]);

export const audioKindSchema = z.enum(["human", "synthetic"]);
export const licenseStatusSchema = z.enum(["clear", "review-needed", "blocked"]);
export const contributionBadgeSchema = z.enum([
  "auto-imported",
  "human-edited",
  "native-reviewed",
  "editor-approved"
]);
export const relatedReasonSchema = z.enum([
  "manual",
  "confusion-cluster",
  "semantic",
  "origin",
  "transliteration",
  "topic"
]);

export const provenanceSchema = z.object({
  id: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string().url(),
  sourceLicense: z.string(),
  sourceRevision: z.string(),
  attributionText: z.string(),
  confidence: z.number().min(0).max(1),
  reviewStatus: reviewStatusSchema,
  fields: z.array(z.string()).min(1),
  notes: z.array(z.string()).default([])
});

export const audioSchema = z.object({
  kind: audioKindSchema,
  src: z.string(),
  mimeType: z.string().default("audio/wav"),
  engine: z.string().nullable().default(null),
  engineInput: z.string().nullable().default(null),
  sourceName: z.string().nullable().default(null),
  sourceUrl: z.string().nullable().default(null),
  license: z.string().nullable().default(null),
  licenseStatus: licenseStatusSchema.default("clear"),
  reviewStatus: reviewStatusSchema,
  confidence: z.number().min(0).max(1)
});

export const pronunciationVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  locale: z.string(),
  ipa: z.string().nullable().default(null),
  respelling: z.string().nullable().default(null),
  notes: z.array(z.string()).default([]),
  audio: audioSchema,
  provenanceIds: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0)
});

export const originSchema = z.object({
  sourceLanguage: z.string().nullable().default(null),
  sourceLanguageName: z.string().nullable().default(null),
  etymologyLabel: z.string().nullable().default(null)
});

export const relatedLinkSchema = z.object({
  slug: z.string(),
  label: z.string(),
  reason: relatedReasonSchema,
  priority: z.number().int()
});

export const indexStatusSchema = z.object({
  mode: z.enum(["index", "noindex"]),
  sitemapEligible: z.boolean(),
  reasons: z.array(z.string()).default([])
});

export const entrySchema = z.object({
  id: z.string(),
  slug: z.string(),
  display: z.string(),
  language: z.string(),
  pos: z.array(z.string()).default([]),
  glosses: z.array(z.string()).default([]),
  shortGloss: z.string().nullable().default(null),
  origin: originSchema,
  topics: z.array(z.string()).default([]),
  variants: z.array(pronunciationVariantSchema).default([]),
  related: z.array(relatedLinkSchema).default([]),
  relatedSeedSlugs: z.array(z.string()).default([]),
  semanticLinkSlugs: z.array(z.string()).default([]),
  confusions: z.array(z.string()).default([]),
  confusionNotes: z.array(z.string()).default([]),
  provenance: z.array(provenanceSchema).default([]),
  qualityScore: z.number().default(0),
  indexStatus: indexStatusSchema,
  searchRank: z.number().default(0),
  badges: z.array(contributionBadgeSchema).default([]),
  bodyHtml: z.string().default(""),
  licenseNotes: z.array(z.string()).default([]),
  reviewers: z.array(z.string()).default([])
});

export const corpusSchema = z.array(entrySchema);

export const normalizedSourceEntrySchema = z.object({
  slug: z.string(),
  display: z.string(),
  language: z.string().default("en"),
  pos: z.array(z.string()).default([]),
  glosses: z.array(z.string()).default([]),
  shortGloss: z.string().nullable().default(null),
  origin: originSchema.default({
    sourceLanguage: null,
    sourceLanguageName: null,
    etymologyLabel: null
  }),
  topics: z.array(z.string()).default([]),
  variants: z.array(pronunciationVariantSchema).default([]),
  relatedSeedSlugs: z.array(z.string()).default([]),
  semanticLinkSlugs: z.array(z.string()).default([]),
  confusions: z.array(z.string()).default([]),
  confusionNotes: z.array(z.string()).default([]),
  provenance: z.array(provenanceSchema).min(1),
  searchRank: z.number().default(0),
  badges: z.array(contributionBadgeSchema).default([]),
  bodyHtml: z.string().default(""),
  licenseNotes: z.array(z.string()).default([]),
  reviewers: z.array(z.string()).default([]),
  sourcePriority: z.number().int()
});

export const overrideVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  lang: z.string(),
  ipa: z.string().nullable().optional(),
  respelling: z.string().nullable().optional(),
  notes: z.array(z.string()).default([]),
  audio_mode: audioKindSchema,
  audio_src: z.string().optional(),
  engine: z.string().optional(),
  engine_input: z.string().optional(),
  source_name: z.string().optional(),
  source_url: z.string().url().optional(),
  license: z.string().optional(),
  license_status: licenseStatusSchema.optional(),
  review_status: reviewStatusSchema,
  confidence: z.number().min(0).max(1).default(0.9)
});

export const overrideFrontmatterSchema = z.object({
  word: z.string(),
  slug: z.string().optional(),
  language: z.string().default("en"),
  display: z.string().optional(),
  origin_language: z.string().nullable().optional(),
  origin_language_name: z.string().nullable().optional(),
  origin_label: z.string().nullable().optional(),
  pos: z.array(z.string()).default([]),
  glosses: z.array(z.string()).default([]),
  short_gloss: z.string().optional(),
  topics: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  confusions: z.array(z.string()).default([]),
  confusion_notes: z.array(z.string()).default([]),
  variants: z.array(overrideVariantSchema).default([]),
  review_state: reviewStatusSchema.optional(),
  badges: z.array(contributionBadgeSchema).default([]),
  license_notes: z.array(z.string()).default([]),
  reviewers: z.array(z.string()).default([]),
  quality_boost: z.number().default(0),
  index_status_override: z.enum(["index", "noindex"]).optional()
});

export const shardFileSchema = z.object({
  language: z.string(),
  shard: z.string(),
  entries: corpusSchema
});

export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type AudioKind = z.infer<typeof audioKindSchema>;
export type LicenseStatus = z.infer<typeof licenseStatusSchema>;
export type ContributionBadge = z.infer<typeof contributionBadgeSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type AudioMetadata = z.infer<typeof audioSchema>;
export type PronunciationVariant = z.infer<typeof pronunciationVariantSchema>;
export type OriginMetadata = z.infer<typeof originSchema>;
export type RelatedLink = z.infer<typeof relatedLinkSchema>;
export type IndexStatus = z.infer<typeof indexStatusSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Corpus = z.infer<typeof corpusSchema>;
export type NormalizedSourceEntry = z.infer<typeof normalizedSourceEntrySchema>;
export type OverrideFrontmatter = z.infer<typeof overrideFrontmatterSchema>;
export type OverrideVariant = z.infer<typeof overrideVariantSchema>;
export type ShardFile = z.infer<typeof shardFileSchema>;
