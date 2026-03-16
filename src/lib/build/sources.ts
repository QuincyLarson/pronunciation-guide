import path from "node:path";
import matter from "gray-matter";

import { slugify } from "../slug";
import {
  corpusSchema,
  normalizedSourceEntrySchema,
  overrideFrontmatterSchema,
  reviewStatusSchema,
  type AudioMetadata,
  type Entry,
  type FieldProvenanceMap,
  type NormalizedSourceEntry,
  type OverrideFrontmatter,
  type PronunciationVariant,
  type Provenance
} from "../../types/content";
import { markdownToHtml } from "../merge";
import { collectFiles, readJsonFile, readTextFile } from "./io";
import { FIXTURE_DIR, OVERRIDES_DIR, PROJECT_ROOT } from "./paths";
import {
  importedSourcesSchema,
  type ImportedSources,
  type RawAudio,
  type RawCmudictEntry,
  type RawIpaDictEntry,
  type RawSourceMetadata,
  type RawWiktionaryEntry,
  type RawWordnetEntry
} from "./source-records";
import { importCmudictFile } from "./importers/cmudict";
import { importIpaDictFile } from "./importers/ipa-dict";
import { importKaikkiFile } from "./importers/kaikki";
import { importOewnFile, importWordnetFile } from "./importers/wordnet";

export { importedSourcesSchema };
export type { ImportedSources };

export interface LoadedOverride {
  path: string;
  frontmatter: OverrideFrontmatter;
  bodyHtml: string;
}

function buildProvenance(
  id: string,
  source: RawSourceMetadata,
  fallbackFields: string[]
): Provenance {
  return {
    id,
    sourceName: source.name,
    sourceUrl: source.url,
    sourceLicense: source.license,
    sourceRevision: source.revision,
    attributionText: source.attribution,
    confidence: source.confidence,
    reviewStatus: source.review_status,
    fields: source.fields ?? fallbackFields,
    notes: source.notes
  };
}

function buildFieldProvenance(provenanceId: string, fields: string[]): FieldProvenanceMap {
  return Object.fromEntries(fields.map((field) => [field, [provenanceId]]));
}

function variantFieldProvenance(provenanceId: string, variant: RawWiktionaryEntry["pronunciations"][number]): FieldProvenanceMap {
  const fields = ["label", "locale"];

  if (variant.ipa) {
    fields.push("ipa");
  }

  if (variant.respelling) {
    fields.push("respelling");
  }

  if (variant.notes.length > 0) {
    fields.push("notes");
  }

  fields.push(
    "audio.kind",
    "audio.src",
    "audio.reviewStatus",
    "audio.confidence"
  );

  if (variant.audio.engine) {
    fields.push("audio.engine");
  }

  if (variant.audio.engine_input) {
    fields.push("audio.engineInput");
  }

  if (variant.audio.engine_inputs && Object.keys(variant.audio.engine_inputs).length > 0) {
    fields.push("audio.engineInputs");
  }

  if (variant.audio.source_name) {
    fields.push("audio.sourceName");
  }

  if (variant.audio.source_url) {
    fields.push("audio.sourceUrl");
  }

  if (variant.audio.license) {
    fields.push("audio.license");
  }

  if (variant.audio.license_status) {
    fields.push("audio.licenseStatus");
  }

  return buildFieldProvenance(provenanceId, fields);
}

function rawAudioToAudio(raw: RawAudio): AudioMetadata {
  return {
    kind: raw.kind,
    src: raw.src,
    mimeType: raw.src.endsWith(".mp3")
      ? "audio/mpeg"
      : raw.src.endsWith(".ogg")
        ? "audio/ogg"
        : "audio/wav",
    engine: raw.engine ?? null,
    engineInput: raw.engine_input ?? null,
    engineInputs: raw.engine_inputs ?? {},
    sourceName: raw.source_name ?? null,
    sourceUrl: raw.source_url ?? null,
    license: raw.license ?? null,
    licenseStatus: raw.license_status ?? "clear",
    reviewStatus: raw.review_status,
    confidence: raw.confidence,
    cachePath: null,
    reviewFlags:
      raw.review_status === "needs-source-check" ? ["needs-source-check"] : [],
    qualityFlags:
      raw.kind === "synthetic" ? ["synthetic-audio"] : []
  };
}

function normalizeWiktionary(
  entries: RawWiktionaryEntry[],
  sourcePrefix: "wiktionary" | "kaikki",
  sourcePriority: number
): NormalizedSourceEntry[] {
  return entries.map((entry) => {
    const slug = slugify(entry.term);
    const provenance = buildProvenance(
      `${sourcePrefix}:${slug}`,
      entry.source ?? {
        name: sourcePrefix === "kaikki" ? "Kaikki/Wiktextract" : "Wiktionary fixture",
        url: "https://kaikki.org/",
        license: "CC BY-SA 4.0 + GFDL",
        revision: "fixture",
        attribution: "Derived from a Wiktionary-family source snapshot.",
        fields: ["display", "glosses", "origin", "variants", "topics", "related"],
        confidence: 0.86,
        review_status: "reviewed",
        notes: []
      },
      ["display", "glosses", "origin", "variants", "topics", "related"]
    );

    const fieldProvenance = buildFieldProvenance(
      provenance.id,
      [
        "display",
        ...(entry.parts_of_speech.length > 0 ? ["pos"] : []),
        ...(entry.definitions.length > 0 ? ["glosses"] : []),
        ...(entry.short_gloss ? ["shortGloss"] : []),
        ...(entry.origin.code ? ["origin.sourceLanguage"] : []),
        ...(entry.origin.name ? ["origin.sourceLanguageName"] : []),
        ...(entry.origin.label ? ["origin.etymologyLabel"] : []),
        ...(entry.topics.length > 0 ? ["topics"] : []),
        ...(entry.related_terms.length > 0 ? ["relatedSeedSlugs"] : []),
        ...(entry.semantic_links.length > 0 ? ["semanticLinkSlugs"] : []),
        ...(entry.confusions.length > 0 ? ["confusions"] : []),
        ...(entry.confusion_notes.length > 0 ? ["confusionNotes"] : []),
        ...(entry.badges.length > 0 ? ["badges"] : [])
      ]
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
        fieldProvenance: variantFieldProvenance(provenance.id, variant),
        audio: rawAudioToAudio(variant.audio)
      })),
      relatedSeedSlugs: entry.related_terms.map(slugify),
      semanticLinkSlugs: entry.semantic_links.map(slugify),
      confusions: entry.confusions.map(slugify),
      confusionNotes: entry.confusion_notes,
      provenance: [provenance],
      fieldProvenance,
      searchRank: entry.search_rank,
      badges: entry.badges,
      sourcePriority
    });
  });
}

function normalizeCmudict(entries: RawCmudictEntry[]): NormalizedSourceEntry[] {
  const counts = new Map<string, number>();

  return entries.map((entry) => {
    const slug = slugify(entry.headword);
    const seen = counts.get(slug) ?? 0;
    counts.set(slug, seen + 1);

    const provenance = buildProvenance(
      `cmudict:${slug}:${seen}`,
      entry.source ?? {
        name: "CMUdict",
        url: "https://github.com/cmusphinx/cmudict",
        license: "CMUdict license",
        revision: "fixture",
        attribution: "US English fallback pronunciation from CMUdict.",
        fields: ["variants"],
        confidence: entry.confidence,
        review_status: "reviewed",
        notes: []
      },
      ["variants"]
    );

    const variantId = entry.variant_key ?? `en-us-cmudict-${seen}`;
    const fieldProvenance = buildFieldProvenance(
      provenance.id,
      [
        ...(entry.parts_of_speech.length > 0 ? ["pos"] : []),
        ...(entry.topics.length > 0 ? ["topics"] : [])
      ]
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
          id: variantId,
          label: "General American",
          locale: "en-US",
          ipa: entry.ipa,
          respelling: entry.respelling ?? null,
          notes: ["Fallback pronunciation imported from CMUdict."],
          provenanceIds: [provenance.id],
          fieldProvenance: buildFieldProvenance(provenance.id, [
            "label",
            "locale",
            "ipa",
            ...(entry.respelling ? ["respelling"] : []),
            "notes",
            "audio.kind",
            "audio.src",
            "audio.engine",
            "audio.engineInput",
            ...(entry.arpabet ? ["audio.engineInputs"] : []),
            "audio.sourceName",
            "audio.sourceUrl",
            "audio.license",
            "audio.licenseStatus",
            "audio.reviewStatus",
            "audio.confidence"
          ]),
          sortOrder: seen,
          audio: {
            kind: "synthetic",
            src: "/audio/fixtures/synthetic-sample.wav",
            mimeType: "audio/wav",
            engine: "cmudict-arpabet",
            engineInput: entry.headword,
            engineInputs: entry.arpabet ? { cmudict_arpabet: entry.arpabet } : {},
            sourceName: provenance.sourceName,
            sourceUrl: provenance.sourceUrl,
            license: provenance.sourceLicense,
            licenseStatus: "clear",
            reviewStatus: "reviewed",
            confidence: entry.confidence,
            cachePath: null,
            reviewFlags: [],
            qualityFlags: ["synthetic-audio", ...(entry.arpabet ? ["arpabet-available"] : [])]
          }
        }
      ],
      relatedSeedSlugs: [],
      semanticLinkSlugs: [],
      confusions: [],
      confusionNotes: [],
      provenance: [provenance],
      fieldProvenance,
      searchRank: entry.search_rank,
      sourcePriority: 50
    });
  });
}

function normalizeWordnet(entries: RawWordnetEntry[], sourcePrefix: "wordnet" | "oewn", sourcePriority: number): NormalizedSourceEntry[] {
  return entries.map((entry) => {
    const slug = slugify(entry.lemma);
    const provenance = buildProvenance(
      `${sourcePrefix}:${slug}`,
      entry.source ?? {
        name: sourcePrefix === "oewn" ? "Open English WordNet" : "Princeton WordNet",
        url:
          sourcePrefix === "oewn"
            ? "https://github.com/globalwordnet/english-wordnet"
            : "https://wordnet.princeton.edu/",
        license: sourcePrefix === "oewn" ? "CC BY 4.0" : "WordNet License",
        revision: "fixture",
        attribution: "Gloss and lexical links imported from WordNet-family data.",
        fields: ["glosses", "related"],
        confidence: 0.82,
        review_status: "reviewed",
        notes: []
      },
      ["glosses", "related"]
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
      fieldProvenance: buildFieldProvenance(
        provenance.id,
        [
          "display",
          ...(entry.parts_of_speech.length > 0 ? ["pos"] : []),
          ...(entry.glosses.length > 0 ? ["glosses"] : []),
          ...(entry.short_gloss ? ["shortGloss"] : []),
          ...(entry.topics.length > 0 ? ["topics"] : []),
          ...(entry.semantic_links.length > 0 ? ["semanticLinkSlugs"] : [])
        ]
      ),
      searchRank: entry.search_rank,
      sourcePriority
    });
  });
}

function normalizeIpaDict(entries: RawIpaDictEntry[]): NormalizedSourceEntry[] {
  const counts = new Map<string, number>();

  return entries.map((entry) => {
    const slug = slugify(entry.headword);
    const seen = counts.get(`${slug}:${entry.locale}`) ?? 0;
    counts.set(`${slug}:${entry.locale}`, seen + 1);
    const provenance = buildProvenance(
      `ipa-dict:${slug}:${entry.locale}:${seen}`,
      entry.source ?? {
        name: "open-dict-data/ipa-dict",
        url: "https://github.com/open-dict-data/ipa-dict",
        license: "Unlicense",
        revision: "fixture",
        attribution: "Supplemental IPA imported from open-dict-data/ipa-dict.",
        fields: ["variants"],
        confidence: entry.confidence,
        review_status: "reviewed",
        notes: []
      },
      ["variants"]
    );

    return normalizedSourceEntrySchema.parse({
      slug,
      display: entry.display ?? entry.headword,
      language: "en",
      pos: [],
      glosses: [],
      shortGloss: null,
      origin: {},
      topics: [],
      variants: [
        {
          id: entry.variant_key ?? `ipa-dict-${entry.locale.toLowerCase()}-${seen}`,
          label: entry.locale === "en-US" ? "IPA Dict US" : entry.locale === "en-GB" ? "IPA Dict UK" : "IPA Dict",
          locale: entry.locale,
          ipa: entry.ipa,
          respelling: entry.respelling ?? null,
          notes: entry.notes,
          provenanceIds: [provenance.id],
          fieldProvenance: buildFieldProvenance(provenance.id, [
            "label",
            "locale",
            "ipa",
            ...(entry.respelling ? ["respelling"] : []),
            ...(entry.notes.length > 0 ? ["notes"] : []),
            "audio.kind",
            "audio.src",
            "audio.engine",
            "audio.engineInput",
            "audio.sourceName",
            "audio.sourceUrl",
            "audio.license",
            "audio.licenseStatus",
            "audio.reviewStatus",
            "audio.confidence"
          ]),
          sortOrder: seen,
          audio: {
            kind: "synthetic",
            src: "/audio/fixtures/synthetic-sample.wav",
            mimeType: "audio/wav",
            engine: "ipa-dict",
            engineInput: entry.headword,
            engineInputs: { ipa_dict: entry.ipa },
            sourceName: provenance.sourceName,
            sourceUrl: provenance.sourceUrl,
            license: provenance.sourceLicense,
            licenseStatus: "clear",
            reviewStatus: "reviewed",
            confidence: entry.confidence,
            cachePath: null,
            reviewFlags: [],
            qualityFlags: ["supplemental-ipa"]
          }
        }
      ],
      relatedSeedSlugs: [],
      semanticLinkSlugs: [],
      confusions: [],
      confusionNotes: [],
      provenance: [provenance],
      fieldProvenance: buildFieldProvenance(provenance.id, ["display"]),
      searchRank: 0,
      sourcePriority: 55
    });
  });
}

async function findFixtureFiles(prefixes: string[], extensions: string[]): Promise<string[]> {
  const files = (
    await Promise.all(extensions.map((extension) => collectFiles(FIXTURE_DIR, extension)))
  ).flat();

  return files
    .filter((filePath) => prefixes.some((prefix) => path.basename(filePath).startsWith(prefix)))
    .sort();
}

async function readLegacyJsonFixtures<T>(prefix: string): Promise<T[]> {
  const files = await findFixtureFiles([prefix], [".json"]);
  const arrays = await Promise.all(files.map((filePath) => readJsonFile<unknown>(filePath)));
  return arrays.flatMap((value) => (Array.isArray(value) ? (value as T[]) : []));
}

export async function importSources(): Promise<ImportedSources> {
  const [wiktionary, kaikkiFiles, cmudictFiles, wordnetFiles, oewnFiles, ipaDictFiles] = await Promise.all([
    readLegacyJsonFixtures<RawWiktionaryEntry>("wiktionary"),
    findFixtureFiles(["kaikki", "wiktextract"], [".jsonl", ".json"]),
    findFixtureFiles(["cmudict"], [".json", ".dict", ".txt"]),
    findFixtureFiles(["wordnet"], [".json"]),
    findFixtureFiles(["oewn", "open-english-wordnet"], [".json"]),
    findFixtureFiles(["ipa-dict", "open-dict-data"], [".json", ".txt", ".tsv", ".dict"])
  ]);

  const [kaikki, cmudict, wordnet, oewn, ipaDict] = await Promise.all([
    Promise.all(kaikkiFiles.map((filePath) => importKaikkiFile(filePath))).then((records) => records.flat()),
    Promise.all(cmudictFiles.map((filePath) => importCmudictFile(filePath))).then((records) => records.flat()),
    Promise.all(wordnetFiles.map((filePath) => importWordnetFile(filePath))).then((records) => records.flat()),
    Promise.all(oewnFiles.map((filePath) => importOewnFile(filePath))).then((records) => records.flat()),
    Promise.all(ipaDictFiles.map((filePath) => importIpaDictFile(filePath))).then((records) => records.flat())
  ]);

  return importedSourcesSchema.parse({
    wiktionary,
    kaikki,
    cmudict,
    wordnet,
    oewn,
    ipaDict
  });
}

export function normalizeImportedSources(importedSources: ImportedSources): NormalizedSourceEntry[] {
  return [
    ...normalizeWiktionary(importedSources.wiktionary, "wiktionary", 70),
    ...normalizeWiktionary(importedSources.kaikki, "kaikki", 75),
    ...normalizeCmudict(importedSources.cmudict),
    ...normalizeWordnet(importedSources.wordnet, "wordnet", 40),
    ...normalizeWordnet(importedSources.oewn, "oewn", 45),
    ...normalizeIpaDict(importedSources.ipaDict)
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
