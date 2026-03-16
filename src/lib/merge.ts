import { marked } from "marked";

import { slugify } from "./slug";
import type {
  AudioMetadata,
  Entry,
  FieldProvenanceMap,
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

function mergeFieldProvenance(stronger: FieldProvenanceMap, weaker: FieldProvenanceMap): FieldProvenanceMap {
  const keys = new Set([...Object.keys(weaker), ...Object.keys(stronger)]);
  const merged: FieldProvenanceMap = {};

  for (const key of keys) {
    const values = [...(weaker[key] ?? []), ...(stronger[key] ?? [])];
    if (values.length > 0) {
      merged[key] = uniqueStrings(values);
    }
  }

  return merged;
}

function buildFieldProvenance(provenanceId: string, fields: string[]): FieldProvenanceMap {
  return Object.fromEntries(fields.map((field) => [field, [provenanceId]]));
}

function pickFieldProvenance(
  field: string,
  stronger: FieldProvenanceMap,
  weaker: FieldProvenanceMap
): string[] | undefined {
  return stronger[field] ?? weaker[field];
}

function mergeAudio(stronger: AudioMetadata, weaker: AudioMetadata): AudioMetadata {
  return {
    ...weaker,
    ...stronger,
    engine: stronger.engine ?? weaker.engine,
    engineInput: stronger.engineInput ?? weaker.engineInput,
    engineInputs: { ...weaker.engineInputs, ...stronger.engineInputs },
    sourceName: stronger.sourceName ?? weaker.sourceName,
    sourceUrl: stronger.sourceUrl ?? weaker.sourceUrl,
    license: stronger.license ?? weaker.license,
    cachePath: stronger.cachePath ?? weaker.cachePath,
    reviewFlags: uniqueStrings([...weaker.reviewFlags, ...stronger.reviewFlags]),
    qualityFlags: uniqueStrings([...weaker.qualityFlags, ...stronger.qualityFlags])
  };
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
      provenanceIds: uniqueStrings([...variant.provenanceIds, ...current.provenanceIds]),
      audio: mergeAudio(variant.audio, current.audio),
      fieldProvenance: {
        ...mergeFieldProvenance(variant.fieldProvenance, current.fieldProvenance),
        ...(pickFieldProvenance("label", variant.fieldProvenance, current.fieldProvenance)
          ? {
              label: pickFieldProvenance("label", variant.fieldProvenance, current.fieldProvenance)
            }
          : {}),
        ...(pickFieldProvenance("locale", variant.fieldProvenance, current.fieldProvenance)
          ? {
              locale: pickFieldProvenance("locale", variant.fieldProvenance, current.fieldProvenance)
            }
          : {}),
        ...(pickFieldProvenance("ipa", variant.fieldProvenance, current.fieldProvenance)
          ? { ipa: pickFieldProvenance("ipa", variant.fieldProvenance, current.fieldProvenance) }
          : {}),
        ...(pickFieldProvenance("respelling", variant.fieldProvenance, current.fieldProvenance)
          ? {
              respelling: pickFieldProvenance(
                "respelling",
                variant.fieldProvenance,
                current.fieldProvenance
              )
            }
          : {})
      }
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
        fieldProvenance: {},
        qualityScore: 0,
        indexStatus: {
          mode: "noindex",
          sitemapEligible: false,
          stage: "candidate",
          tier: "candidate",
          usefulnessScore: 0,
          reasons: ["pending quality evaluation"],
          signals: []
        },
        searchRank: 0,
        badges: [],
        bodyHtml: "",
        licenseNotes: [],
        reviewers: []
      };

      for (const current of sorted) {
        const displayWasEmpty = !merged.display;
        merged.display = merged.display || current.display;
        if (displayWasEmpty && current.fieldProvenance.display) {
          merged.fieldProvenance.display = current.fieldProvenance.display;
        }

        merged.language = merged.language || current.language;
        merged.pos = uniqueStrings([...merged.pos, ...current.pos]);
        if (current.fieldProvenance.pos) {
          merged.fieldProvenance.pos = uniqueStrings([
            ...(merged.fieldProvenance.pos ?? []),
            ...current.fieldProvenance.pos
          ]);
        }

        merged.glosses = uniqueStrings([...merged.glosses, ...current.glosses]);
        if (current.fieldProvenance.glosses) {
          merged.fieldProvenance.glosses = uniqueStrings([
            ...(merged.fieldProvenance.glosses ?? []),
            ...current.fieldProvenance.glosses
          ]);
        }

        const shortGlossWasEmpty = merged.shortGloss === null;
        merged.shortGloss = merged.shortGloss ?? current.shortGloss;
        if (shortGlossWasEmpty && current.shortGloss && current.fieldProvenance.shortGloss) {
          merged.fieldProvenance.shortGloss = current.fieldProvenance.shortGloss;
        }

        if (!merged.origin.sourceLanguage && current.origin.sourceLanguage) {
          merged.origin = current.origin;
          for (const field of [
            "origin.sourceLanguage",
            "origin.sourceLanguageName",
            "origin.etymologyLabel"
          ]) {
            if (current.fieldProvenance[field]) {
              merged.fieldProvenance[field] = current.fieldProvenance[field];
            }
          }
        }

        merged.topics = uniqueStrings([...merged.topics, ...current.topics]);
        if (current.fieldProvenance.topics) {
          merged.fieldProvenance.topics = uniqueStrings([
            ...(merged.fieldProvenance.topics ?? []),
            ...current.fieldProvenance.topics
          ]);
        }

        merged.variants = mergeVariants(merged.variants, current.variants);
        merged.relatedSeedSlugs = uniqueStrings([
          ...merged.relatedSeedSlugs,
          ...current.relatedSeedSlugs
        ]);
        if (current.fieldProvenance.relatedSeedSlugs) {
          merged.fieldProvenance.relatedSeedSlugs = uniqueStrings([
            ...(merged.fieldProvenance.relatedSeedSlugs ?? []),
            ...current.fieldProvenance.relatedSeedSlugs
          ]);
        }

        merged.semanticLinkSlugs = uniqueStrings([
          ...merged.semanticLinkSlugs,
          ...current.semanticLinkSlugs
        ]);
        if (current.fieldProvenance.semanticLinkSlugs) {
          merged.fieldProvenance.semanticLinkSlugs = uniqueStrings([
            ...(merged.fieldProvenance.semanticLinkSlugs ?? []),
            ...current.fieldProvenance.semanticLinkSlugs
          ]);
        }

        merged.confusions = uniqueStrings([...merged.confusions, ...current.confusions]);
        if (current.fieldProvenance.confusions) {
          merged.fieldProvenance.confusions = uniqueStrings([
            ...(merged.fieldProvenance.confusions ?? []),
            ...current.fieldProvenance.confusions
          ]);
        }

        merged.confusionNotes = uniqueStrings([
          ...merged.confusionNotes,
          ...current.confusionNotes
        ]);
        if (current.fieldProvenance.confusionNotes) {
          merged.fieldProvenance.confusionNotes = uniqueStrings([
            ...(merged.fieldProvenance.confusionNotes ?? []),
            ...current.fieldProvenance.confusionNotes
          ]);
        }

        merged.provenance = uniqueProvenance([...merged.provenance, ...current.provenance]);
        merged.searchRank = Math.max(merged.searchRank, current.searchRank);
        merged.badges = uniqueStrings([...merged.badges, ...current.badges]) as Entry["badges"];
        if (current.fieldProvenance.badges) {
          merged.fieldProvenance.badges = uniqueStrings([
            ...(merged.fieldProvenance.badges ?? []),
            ...current.fieldProvenance.badges
          ]);
        }

        const bodyWasEmpty = !merged.bodyHtml;
        merged.bodyHtml = merged.bodyHtml || current.bodyHtml;
        if (bodyWasEmpty && current.bodyHtml && current.fieldProvenance.bodyHtml) {
          merged.fieldProvenance.bodyHtml = current.fieldProvenance.bodyHtml;
        }

        merged.licenseNotes = uniqueStrings([...merged.licenseNotes, ...current.licenseNotes]);
        if (current.fieldProvenance.licenseNotes) {
          merged.fieldProvenance.licenseNotes = uniqueStrings([
            ...(merged.fieldProvenance.licenseNotes ?? []),
            ...current.fieldProvenance.licenseNotes
          ]);
        }

        merged.reviewers = uniqueStrings([...merged.reviewers, ...current.reviewers]);
        if (current.fieldProvenance.reviewers) {
          merged.fieldProvenance.reviewers = uniqueStrings([
            ...(merged.fieldProvenance.reviewers ?? []),
            ...current.fieldProvenance.reviewers
          ]);
        }
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
    fieldProvenance: mergeFieldProvenance(
      buildFieldProvenance(provenanceId, [
        "label",
        "locale",
        ...(variant.ipa ? ["ipa"] : []),
        ...(variant.respelling ? ["respelling"] : []),
        ...(variant.notes.length > 0 ? ["notes"] : []),
        "audio.kind",
        ...(variant.audio_src ? ["audio.src"] : []),
        ...(variant.engine ? ["audio.engine"] : []),
        ...(variant.engine_input ? ["audio.engineInput"] : []),
        ...(variant.engine_inputs ? ["audio.engineInputs"] : []),
        ...(variant.source_name ? ["audio.sourceName"] : []),
        ...(variant.source_url ? ["audio.sourceUrl"] : []),
        ...(variant.license ? ["audio.license"] : []),
        ...(variant.license_status ? ["audio.licenseStatus"] : []),
        "audio.reviewStatus",
        "audio.confidence"
      ]),
      {}
    ),
    audio: {
      kind: variant.audio_mode,
      src: variant.audio_src ?? "/audio/fixtures/synthetic-sample.wav",
      mimeType: "audio/wav",
      engine: variant.engine ?? null,
      engineInput: variant.engine_input ?? null,
      engineInputs: variant.engine_inputs ?? {},
      sourceName: variant.source_name ?? null,
      sourceUrl: variant.source_url ?? null,
      license: variant.license ?? null,
      licenseStatus: variant.license_status ?? "clear",
      reviewStatus: variant.review_status,
      confidence: variant.confidence,
      cachePath: null,
      reviewFlags: [],
      qualityFlags: []
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
    fieldProvenance: mergeFieldProvenance(
      buildFieldProvenance(provenanceId, [
        "display",
        ...(override.pos.length > 0 ? ["pos"] : []),
        ...(override.glosses.length > 0 ? ["glosses"] : []),
        ...(override.short_gloss ? ["shortGloss"] : []),
        ...(override.origin_language ? ["origin.sourceLanguage"] : []),
        ...(override.origin_language_name ? ["origin.sourceLanguageName"] : []),
        ...(override.origin_label ? ["origin.etymologyLabel"] : []),
        ...(override.topics.length > 0 ? ["topics"] : []),
        ...(override.related.length > 0 ? ["relatedSeedSlugs"] : []),
        ...(override.confusions.length > 0 ? ["confusions"] : []),
        ...(override.confusion_notes.length > 0 ? ["confusionNotes"] : []),
        ...(override.badges.length > 0 ? ["badges"] : []),
        ...(overrideBody ? ["bodyHtml"] : []),
        ...(override.license_notes.length > 0 ? ["licenseNotes"] : []),
        ...(override.reviewers.length > 0 ? ["reviewers"] : [])
      ]),
      entry.fieldProvenance
    ),
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
      stage: override.index_status_override === "index" ? "indexable" : "candidate",
      tier: override.index_status_override === "index" ? "expanded" : "candidate",
      usefulnessScore: next.qualityScore,
      reasons: [`override forced ${override.index_status_override}`],
      signals: ["manual-index-override"]
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
