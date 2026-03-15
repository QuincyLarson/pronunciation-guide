import { marked } from "marked";

import { slugify } from "./slug";
import type {
  Entry,
  NormalizedSourceEntry,
  OverrideFrontmatter,
  OverrideVariant,
  PronunciationVariant,
  Provenance
} from "../types/content";
import { entrySchema, pronunciationVariantSchema } from "../types/content";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueProvenance(values: Provenance[]): Provenance[] {
  const seen = new Set<string>();
  const result: Provenance[] = [];

  for (const provenance of values) {
    if (seen.has(provenance.id)) {
      continue;
    }

    seen.add(provenance.id);
    result.push(provenance);
  }

  return result;
}

function mergeVariants(
  stronger: PronunciationVariant[],
  weaker: PronunciationVariant[]
): PronunciationVariant[] {
  const merged = new Map<string, PronunciationVariant>();

  for (const variant of [...weaker, ...stronger]) {
    const current = merged.get(variant.id);
    if (!current) {
      merged.set(variant.id, variant);
      continue;
    }

    merged.set(variant.id, pronunciationVariantSchema.parse({
      ...current,
      ...variant,
      ipa: variant.ipa ?? current.ipa,
      respelling: variant.respelling ?? current.respelling,
      notes: uniqueStrings([...variant.notes, ...current.notes]),
      provenanceIds: uniqueStrings([...variant.provenanceIds, ...current.provenanceIds])
    }));
  }

  return [...merged.values()].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function mergeNormalizedEntries(entries: NormalizedSourceEntry[]): Entry[] {
  const grouped = new Map<string, NormalizedSourceEntry[]>();

  for (const entry of entries) {
    const current = grouped.get(entry.slug) ?? [];
    current.push(entry);
    grouped.set(entry.slug, current);
  }

  return [...grouped.entries()]
    .map(([slug, group]) => {
      const sorted = [...group].sort((left, right) => right.sourcePriority - left.sourcePriority);
      const strongest = sorted[0];

      const merged: Entry = {
        id: `${strongest.language}:${slug}`,
        slug,
        display: strongest.display,
        language: strongest.language,
        pos: [],
        glosses: [],
        shortGloss: null,
        origin: strongest.origin,
        topics: [],
        variants: [],
        related: [],
        relatedSeedSlugs: [],
        semanticLinkSlugs: [],
        confusions: [],
        confusionNotes: [],
        provenance: [],
        qualityScore: 0,
        indexStatus: {
          mode: "noindex",
          sitemapEligible: false,
          reasons: ["pending quality evaluation"]
        },
        searchRank: 0,
        badges: [],
        bodyHtml: "",
        licenseNotes: [],
        reviewers: []
      };

      for (const current of sorted) {
        merged.display = merged.display || current.display;
        merged.language = merged.language || current.language;
        merged.pos = uniqueStrings([...merged.pos, ...current.pos]);
        merged.glosses = uniqueStrings([...merged.glosses, ...current.glosses]);
        merged.shortGloss = merged.shortGloss ?? current.shortGloss;
        merged.origin = merged.origin.sourceLanguage ? merged.origin : current.origin;
        merged.topics = uniqueStrings([...merged.topics, ...current.topics]);
        merged.variants = mergeVariants(merged.variants, current.variants);
        merged.relatedSeedSlugs = uniqueStrings([
          ...merged.relatedSeedSlugs,
          ...current.relatedSeedSlugs
        ]);
        merged.semanticLinkSlugs = uniqueStrings([
          ...merged.semanticLinkSlugs,
          ...current.semanticLinkSlugs
        ]);
        merged.confusions = uniqueStrings([...merged.confusions, ...current.confusions]);
        merged.confusionNotes = uniqueStrings([
          ...merged.confusionNotes,
          ...current.confusionNotes
        ]);
        merged.provenance = uniqueProvenance([...merged.provenance, ...current.provenance]);
        merged.searchRank = Math.max(merged.searchRank, current.searchRank);
        merged.badges = uniqueStrings([...merged.badges, ...current.badges]) as Entry["badges"];
        merged.bodyHtml = merged.bodyHtml || current.bodyHtml;
        merged.licenseNotes = uniqueStrings([...merged.licenseNotes, ...current.licenseNotes]);
        merged.reviewers = uniqueStrings([...merged.reviewers, ...current.reviewers]);
      }

      merged.shortGloss = merged.shortGloss ?? merged.glosses[0] ?? null;
      return entrySchema.parse(merged);
    })
    .sort((left, right) => right.searchRank - left.searchRank || left.slug.localeCompare(right.slug));
}

function overrideVariantToVariant(
  variant: OverrideVariant,
  provenanceId: string,
  sortOrder: number
): PronunciationVariant {
  return pronunciationVariantSchema.parse({
    id: variant.id,
    label: variant.label,
    locale: variant.lang,
    ipa: variant.ipa ?? null,
    respelling: variant.respelling ?? null,
    notes: variant.notes,
    sortOrder,
    provenanceIds: [provenanceId],
    audio: {
      kind: variant.audio_mode,
      src: variant.audio_src ?? "/audio/fixtures/synthetic-sample.wav",
      mimeType: "audio/wav",
      engine: variant.engine ?? null,
      engineInput: variant.engine_input ?? null,
      sourceName: variant.source_name ?? null,
      sourceUrl: variant.source_url ?? null,
      license: variant.license ?? null,
      licenseStatus: variant.license_status ?? "clear",
      reviewStatus: variant.review_status,
      confidence: variant.confidence
    }
  });
}

export function applyOverride(
  entry: Entry,
  override: OverrideFrontmatter,
  overrideBody: string,
  overridePath: string
): Entry {
  const slug = override.slug ?? entry.slug ?? slugify(override.word);
  const provenanceId = `override:${slug}`;
  const overrideProvenance: Provenance = {
    id: provenanceId,
    sourceName: "Repository override",
    sourceUrl: `https://github.com/QuincyLarson/pronunciation-guide/blob/main/${overridePath}`,
    sourceLicense: "BSD-3-Clause for repository content; see attribution page for imported sources",
    sourceRevision: "working-tree",
    attributionText: `Human override from ${overridePath}`,
    confidence: 0.98,
    reviewStatus: override.review_state ?? "human-edited",
    fields: [
      "display",
      "glosses",
      "pos",
      "origin",
      "topics",
      "variants",
      "related",
      "confusions"
    ],
    notes: override.license_notes
  };

  const next: Entry = {
    ...entry,
    id: `${override.language}:${slug}`,
    slug,
    display: override.display ?? override.word ?? entry.display,
    language: override.language ?? entry.language,
    pos: override.pos.length > 0 ? override.pos : entry.pos,
    glosses: override.glosses.length > 0 ? override.glosses : entry.glosses,
    shortGloss: override.short_gloss ?? entry.shortGloss,
    origin: {
      sourceLanguage: override.origin_language ?? entry.origin.sourceLanguage,
      sourceLanguageName: override.origin_language_name ?? entry.origin.sourceLanguageName,
      etymologyLabel: override.origin_label ?? entry.origin.etymologyLabel
    },
    topics: uniqueStrings([...override.topics, ...entry.topics]),
    variants:
      override.variants.length > 0
        ? mergeVariants(
            override.variants.map((variant, index) =>
              overrideVariantToVariant(variant, provenanceId, index)
            ),
            entry.variants
          )
        : entry.variants,
    relatedSeedSlugs: uniqueStrings([...override.related, ...entry.relatedSeedSlugs]),
    confusions: uniqueStrings([...override.confusions, ...entry.confusions]),
    confusionNotes: uniqueStrings([...override.confusion_notes, ...entry.confusionNotes]),
    provenance: uniqueProvenance([overrideProvenance, ...entry.provenance]),
    badges: uniqueStrings([
      ...(override.badges.length > 0 ? override.badges : []),
      ...entry.badges
    ]) as Entry["badges"],
    bodyHtml: overrideBody || entry.bodyHtml,
    licenseNotes: uniqueStrings([...override.license_notes, ...entry.licenseNotes]),
    reviewers: uniqueStrings([...override.reviewers, ...entry.reviewers]),
    qualityScore: entry.qualityScore + override.quality_boost
  };

  if (override.index_status_override) {
    next.indexStatus = {
      mode: override.index_status_override,
      sitemapEligible: override.index_status_override === "index",
      reasons: [`override forced ${override.index_status_override}`]
    };
  }

  next.shortGloss = next.shortGloss ?? next.glosses[0] ?? null;
  return entrySchema.parse(next);
}

export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) {
    return "";
  }

  return marked.parse(markdown, { async: false }) as string;
}
