import path from "node:path";
import matter from "gray-matter";

import { slugify } from "../slug";
import {
  audioKindSchema,
  contributionBadgeSchema,
  corpusSchema,
  licenseStatusSchema,
  normalizedSourceEntrySchema,
  overrideFrontmatterSchema,
  reviewStatusSchema,
  type AudioMetadata,
  type Entry,
  type NormalizedSourceEntry,
  type OverrideFrontmatter,
  type Provenance
} from "../../types/content";
import { markdownToHtml } from "../merge";
import { collectFiles, readJsonFile, readTextFile } from "./io";
import { FIXTURE_DIR, OVERRIDES_DIR, PROJECT_ROOT } from "./paths";
import { z } from "zod";

const rawAudioSchema = z.object({
  kind: audioKindSchema,
  src: z.string(),
  engine: z.string().optional(),
  engine_input: z.string().optional(),
  source_name: z.string().optional(),
  source_url: z.string().url().optional(),
  license: z.string().optional(),
  license_status: licenseStatusSchema.optional(),
  review_status: reviewStatusSchema,
  confidence: z.number().min(0).max(1)
});

const rawSourceMetadataSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  license: z.string(),
  revision: z.string(),
  attribution: z.string(),
  fields: z.array(z.string()).min(1).optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  review_status: reviewStatusSchema.default("reviewed")
});

const rawWiktionaryEntrySchema = z.object({
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

const rawCmudictEntrySchema = z.object({
  headword: z.string(),
  ipa: z.string(),
  respelling: z.string(),
  parts_of_speech: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.88),
  search_rank: z.number().default(0)
});

const rawWordnetEntrySchema = z.object({
  lemma: z.string(),
  glosses: z.array(z.string()).default([]),
  short_gloss: z.string().optional(),
  parts_of_speech: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  semantic_links: z.array(z.string()).default([]),
  search_rank: z.number().default(0)
});

export const importedSourcesSchema = z.object({
  wiktionary: z.array(rawWiktionaryEntrySchema),
  cmudict: z.array(rawCmudictEntrySchema),
  wordnet: z.array(rawWordnetEntrySchema)
});

export interface ImportedSources extends z.infer<typeof importedSourcesSchema> {}

export interface LoadedOverride {
  path: string;
  frontmatter: OverrideFrontmatter;
  bodyHtml: string;
}

function buildProvenance(
  id: string,
  sourceName: string,
  sourceUrl: string,
  sourceLicense: string,
  sourceRevision: string,
  attributionText: string,
  fields: string[],
  confidence: number,
  reviewStatus: z.infer<typeof reviewStatusSchema>
): Provenance {
  return {
    id,
    sourceName,
    sourceUrl,
    sourceLicense,
    sourceRevision,
    attributionText,
    confidence,
    reviewStatus,
    fields,
    notes: []
  };
}

function rawAudioToAudio(raw: z.infer<typeof rawAudioSchema>): AudioMetadata {
  return {
    kind: raw.kind,
    src: raw.src,
    mimeType: "audio/wav",
    engine: raw.engine ?? null,
    engineInput: raw.engine_input ?? null,
    sourceName: raw.source_name ?? null,
    sourceUrl: raw.source_url ?? null,
    license: raw.license ?? null,
    licenseStatus: raw.license_status ?? "clear",
    reviewStatus: raw.review_status,
    confidence: raw.confidence
  };
}

function normalizeWiktionary(entries: z.infer<typeof rawWiktionaryEntrySchema>[]): NormalizedSourceEntry[] {
  return entries.map((entry) => {
    const slug = slugify(entry.term);
    const source = entry.source;
    const provenance = buildProvenance(
      `wiktionary:${slug}`,
      source?.name ?? "Kaikki/Wiktextract fixture",
      source?.url ?? "https://kaikki.org/",
      source?.license ?? "CC BY-SA 4.0 + GFDL",
      source?.revision ?? "fixture-2026-03-14",
      source?.attribution ?? "Derived from a local Wiktionary fixture snapshot.",
      source?.fields ?? ["display", "glosses", "origin", "variants", "topics", "related"],
      source?.confidence ?? 0.86,
      source?.review_status ?? "reviewed"
    );

    return normalizedSourceEntrySchema.parse({
      slug,
      display: entry.display,
      language: entry.language,
      pos: entry.parts_of_speech,
      glosses: entry.definitions,
      shortGloss: entry.short_gloss ?? null,
      origin: {
        sourceLanguage: entry.origin.code ?? null,
        sourceLanguageName: entry.origin.name ?? null,
        etymologyLabel: entry.origin.label ?? null
      },
      topics: entry.topics,
      variants: entry.pronunciations.map((variant, index) => ({
        id: variant.id,
        label: variant.label,
        locale: variant.locale,
        ipa: variant.ipa ?? null,
        respelling: variant.respelling ?? null,
        notes: variant.notes,
        sortOrder: index,
        provenanceIds: [provenance.id],
        audio: rawAudioToAudio(variant.audio)
      })),
      relatedSeedSlugs: entry.related_terms.map(slugify),
      semanticLinkSlugs: entry.semantic_links.map(slugify),
      confusions: entry.confusions.map(slugify),
      confusionNotes: entry.confusion_notes,
      provenance: [provenance],
      searchRank: entry.search_rank,
      badges: entry.badges,
      sourcePriority: 70
    });
  });
}

function normalizeCmudict(entries: z.infer<typeof rawCmudictEntrySchema>[]): NormalizedSourceEntry[] {
  return entries.map((entry) => {
    const slug = slugify(entry.headword);
    const provenance = buildProvenance(
      `cmudict:${slug}`,
      "CMUdict fixture",
      "https://github.com/cmusphinx/cmudict",
      "CMUdict license",
      "fixture-2026-03-14",
      "US English fallback pronunciation from a local CMUdict-like fixture.",
      ["variants"],
      entry.confidence,
      "reviewed"
    );

    return normalizedSourceEntrySchema.parse({
      slug,
      display: entry.headword,
      language: "en",
      pos: entry.parts_of_speech,
      glosses: [],
      shortGloss: null,
      origin: {},
      topics: entry.topics,
      variants: [
        {
          id: "en-us-cmudict",
          label: "General American",
          locale: "en-US",
          ipa: entry.ipa,
          respelling: entry.respelling,
          notes: ["Fallback pronunciation from the CMUdict-derived fixture."],
          provenanceIds: [provenance.id],
          sortOrder: 0,
          audio: {
            kind: "synthetic",
            src: "/audio/fixtures/synthetic-sample.wav",
            mimeType: "audio/wav",
            engine: "espeak-ng",
            engineInput: entry.headword,
            sourceName: "Synthetic fixture",
            sourceUrl: "https://github.com/espeak-ng/espeak-ng",
            license: "GPL-3.0-or-later",
            licenseStatus: "clear",
            reviewStatus: "reviewed",
            confidence: entry.confidence
          }
        }
      ],
      relatedSeedSlugs: [],
      semanticLinkSlugs: [],
      confusions: [],
      confusionNotes: [],
      provenance: [provenance],
      searchRank: entry.search_rank,
      sourcePriority: 50
    });
  });
}

function normalizeWordnet(entries: z.infer<typeof rawWordnetEntrySchema>[]): NormalizedSourceEntry[] {
  return entries.map((entry) => {
    const slug = slugify(entry.lemma);
    const provenance = buildProvenance(
      `wordnet:${slug}`,
      "Princeton WordNet fixture",
      "https://wordnet.princeton.edu/",
      "WordNet License",
      "fixture-2026-03-14",
      "Gloss and semantic relations from a local WordNet-like fixture.",
      ["glosses", "related"],
      0.82,
      "reviewed"
    );

    return normalizedSourceEntrySchema.parse({
      slug,
      display: entry.lemma,
      language: "en",
      pos: entry.parts_of_speech,
      glosses: entry.glosses,
      shortGloss: entry.short_gloss ?? null,
      origin: {},
      topics: entry.topics,
      variants: [],
      relatedSeedSlugs: [],
      semanticLinkSlugs: entry.semantic_links.map(slugify),
      confusions: [],
      confusionNotes: [],
      provenance: [provenance],
      searchRank: entry.search_rank,
      sourcePriority: 40
    });
  });
}

export async function importSources(): Promise<ImportedSources> {
  const [wiktionary, cmudict, wordnet] = await Promise.all([
    readFixtureEntries<z.infer<typeof rawWiktionaryEntrySchema>>("wiktionary"),
    readFixtureEntries<z.infer<typeof rawCmudictEntrySchema>>("cmudict"),
    readFixtureEntries<z.infer<typeof rawWordnetEntrySchema>>("wordnet")
  ]);

  return importedSourcesSchema.parse({ wiktionary, cmudict, wordnet });
}

async function readFixtureEntries<T>(prefix: string): Promise<T[]> {
  const files = (await collectFiles(FIXTURE_DIR, ".json")).filter((filePath) =>
    path.basename(filePath).startsWith(prefix)
  );

  const arrays = await Promise.all(files.map((filePath) => readJsonFile<unknown>(filePath)));
  return arrays.flatMap((value) => (Array.isArray(value) ? (value as T[]) : []));
}

export function normalizeImportedSources(importedSources: ImportedSources): NormalizedSourceEntry[] {
  return [
    ...normalizeWiktionary(importedSources.wiktionary),
    ...normalizeCmudict(importedSources.cmudict),
    ...normalizeWordnet(importedSources.wordnet)
  ];
}

export async function loadOverrides(): Promise<LoadedOverride[]> {
  const files = await collectFiles(OVERRIDES_DIR, ".md");

  return Promise.all(
    files.map(async (filePath) => {
      const raw = await readTextFile(filePath);
      const parsed = matter(raw);
      const relativePath = path.relative(PROJECT_ROOT, filePath);

      return {
        path: relativePath,
        frontmatter: overrideFrontmatterSchema.parse(parsed.data),
        bodyHtml: markdownToHtml(parsed.content)
      };
    })
  );
}

export function parseCorpus(raw: unknown): Entry[] {
  return corpusSchema.parse(raw);
}
