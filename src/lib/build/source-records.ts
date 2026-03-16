import { z } from "zod";

import {
  audioKindSchema,
  contributionBadgeSchema,
  licenseStatusSchema,
  reviewStatusSchema
} from "../../types/content";

export const rawAudioSchema = z.object({
  kind: audioKindSchema,
  src: z.string(),
  engine: z.string().optional(),
  engine_input: z.string().optional(),
  engine_inputs: z.record(z.string(), z.string()).optional(),
  source_name: z.string().optional(),
  source_url: z.string().url().optional(),
  license: z.string().optional(),
  license_status: licenseStatusSchema.optional(),
  review_status: reviewStatusSchema,
  confidence: z.number().min(0).max(1)
});

export const rawSourceMetadataSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  license: z.string(),
  revision: z.string(),
  attribution: z.string(),
  fields: z.array(z.string()).min(1).optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  review_status: reviewStatusSchema.default("reviewed"),
  notes: z.array(z.string()).default([])
});

export const rawWiktionaryEntrySchema = z.object({
  term: z.string(),
  display: z.string(),
  language: z.string(),
  parts_of_speech: z.array(z.string()).default([]),
  definitions: z.array(z.string()).default([]),
  short_gloss: z.string().optional(),
  origin: z
    .object({
      code: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      label: z.string().nullable().optional()
    })
    .default({}),
  topics: z.array(z.string()).default([]),
  pronunciations: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        locale: z.string(),
        ipa: z.string().nullable().optional(),
        respelling: z.string().nullable().optional(),
        notes: z.array(z.string()).default([]),
        audio: rawAudioSchema
      })
    )
    .default([]),
  related_terms: z.array(z.string()).default([]),
  semantic_links: z.array(z.string()).default([]),
  confusions: z.array(z.string()).default([]),
  confusion_notes: z.array(z.string()).default([]),
  search_rank: z.number().default(0),
  badges: z.array(contributionBadgeSchema).default([]),
  source: rawSourceMetadataSchema.optional()
});

export const rawCmudictEntrySchema = z.object({
  headword: z.string(),
  variant_key: z.string().optional(),
  ipa: z.string(),
  respelling: z.string().nullable().optional(),
  arpabet: z.string().optional(),
  parts_of_speech: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.88),
  search_rank: z.number().default(0),
  source: rawSourceMetadataSchema.optional()
});

export const rawWordnetEntrySchema = z.object({
  lemma: z.string(),
  glosses: z.array(z.string()).default([]),
  short_gloss: z.string().optional(),
  parts_of_speech: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  semantic_links: z.array(z.string()).default([]),
  search_rank: z.number().default(0),
  source: rawSourceMetadataSchema.optional()
});

export const rawIpaDictEntrySchema = z.object({
  headword: z.string(),
  variant_key: z.string().optional(),
  display: z.string().optional(),
  locale: z.string().default("en"),
  ipa: z.string(),
  respelling: z.string().nullable().optional(),
  notes: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.78),
  source: rawSourceMetadataSchema.optional()
});

export const importedSourcesSchema = z.object({
  wiktionary: z.array(rawWiktionaryEntrySchema),
  kaikki: z.array(rawWiktionaryEntrySchema),
  cmudict: z.array(rawCmudictEntrySchema),
  wordnet: z.array(rawWordnetEntrySchema),
  oewn: z.array(rawWordnetEntrySchema),
  ipaDict: z.array(rawIpaDictEntrySchema)
});

export type RawAudio = z.infer<typeof rawAudioSchema>;
export type RawSourceMetadata = z.infer<typeof rawSourceMetadataSchema>;
export type RawWiktionaryEntry = z.infer<typeof rawWiktionaryEntrySchema>;
export type RawCmudictEntry = z.infer<typeof rawCmudictEntrySchema>;
export type RawWordnetEntry = z.infer<typeof rawWordnetEntrySchema>;
export type RawIpaDictEntry = z.infer<typeof rawIpaDictEntrySchema>;
export type ImportedSources = z.infer<typeof importedSourcesSchema>;
