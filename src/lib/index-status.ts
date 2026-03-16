import {
  AUDIO_CONFIDENCE_FLOOR,
  MIN_RELATED_LINKS_FOR_INDEXING,
  MIN_USEFULNESS_SCORE_FOR_CORE,
  MIN_USEFULNESS_SCORE_FOR_INDEXING
} from "./constants";
import { isStableSlug } from "./slug";
import type { Entry, IndexStatus } from "../types/content";
import type {
  GraduationPromotion,
  GraduationRules,
  GraduationSuppression,
  SearchConsolePromotion
} from "../types/graduation";

export interface IndexStatusRules {
  minUsefulnessScoreForIndexing: number;
  minUsefulnessScoreForCore: number;
  promotions: Map<string, GraduationPromotion>;
  searchConsolePromotions: Map<string, SearchConsolePromotion>;
  suppressions: Map<string, GraduationSuppression>;
}

const DEFAULT_INDEX_STATUS_RULES: IndexStatusRules = {
  minUsefulnessScoreForIndexing: MIN_USEFULNESS_SCORE_FOR_INDEXING,
  minUsefulnessScoreForCore: MIN_USEFULNESS_SCORE_FOR_CORE,
  promotions: new Map(),
  searchConsolePromotions: new Map(),
  suppressions: new Map()
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function createIndexStatusRules(rules: GraduationRules): IndexStatusRules {
  return {
    minUsefulnessScoreForIndexing: rules.metadataThresholds.minUsefulnessScoreForIndexing,
    minUsefulnessScoreForCore: rules.metadataThresholds.minUsefulnessScoreForCore,
    promotions: new Map(rules.manual.promote.map((rule) => [rule.slug, rule])),
    searchConsolePromotions: new Map(rules.searchConsole.promote.map((rule) => [rule.slug, rule])),
    suppressions: new Map(
      [...rules.manual.suppress, ...rules.searchConsole.suppress].map((rule) => [rule.slug, rule])
    )
  };
}

export function computeQualityScore(entry: Entry): number {
  let score = 0;

  if (entry.glosses.length > 0) {
    score += 18;
  }

  if (entry.shortGloss) {
    score += 8;
  }

  if (entry.origin.sourceLanguage) {
    score += 7;
  }

  if (entry.related.length >= MIN_RELATED_LINKS_FOR_INDEXING) {
    score += 14;
  }

  if (entry.variants.length > 1) {
    score += 10;
  }

  if (entry.variants.some((variant) => variant.audio.kind === "human")) {
    score += 16;
  }

  if (entry.variants.every((variant) => variant.audio.reviewStatus !== "unreviewed")) {
    score += 8;
  }

  if (entry.badges.includes("human-edited")) {
    score += 7;
  }

  if (entry.badges.includes("native-reviewed")) {
    score += 7;
  }

  score += Math.round(
    entry.variants.reduce((sum, variant) => sum + variant.audio.confidence, 0) *
      (entry.variants.length > 0 ? 6 / entry.variants.length : 0)
  );

  return Math.min(score, 100);
}

export function computeIndexStatus(
  entry: Entry,
  rules: IndexStatusRules = DEFAULT_INDEX_STATUS_RULES
): IndexStatus {
  const reasons: string[] = [];
  const signals: string[] = [];

  if (!isStableSlug(entry.slug)) {
    reasons.push("slug is not stable");
  } else {
    signals.push("stable-slug");
  }

  if (entry.variants.length === 0) {
    reasons.push("missing pronunciation variants");
  } else {
    signals.push("has-pronunciation-variants");
  }

  if (entry.glosses.length === 0) {
    reasons.push("missing gloss");
  } else {
    signals.push("has-gloss");
  }

  if (entry.provenance.length === 0) {
    reasons.push("missing provenance");
  } else {
    signals.push("has-provenance");
  }

  if (entry.related.length < MIN_RELATED_LINKS_FOR_INDEXING) {
    reasons.push("needs at least two useful internal links");
  } else {
    signals.push("linked-into-site-graph");
  }

  if (
    entry.variants.some(
      (variant) =>
        variant.audio.licenseStatus !== "clear" ||
        variant.audio.confidence < AUDIO_CONFIDENCE_FLOOR
    )
  ) {
    reasons.push("contains low-confidence audio or unresolved licensing");
  } else if (entry.variants.length > 0) {
    signals.push("audio-license-clear");
  }

  if (
    entry.variants.every((variant) => variant.audio.kind === "synthetic") &&
    entry.bodyHtml.length === 0 &&
    entry.glosses.join(" ").length < 80
  ) {
    reasons.push("synthetic-only entry lacks enough supporting content");
  }

  const usefulnessScore = entry.qualityScore;
  const manualPromotion = rules.promotions.get(entry.slug);
  const searchConsolePromotion = rules.searchConsolePromotions.get(entry.slug);
  const suppression = rules.suppressions.get(entry.slug);

  if (usefulnessScore >= rules.minUsefulnessScoreForIndexing) {
    signals.push(`metadata-threshold-${rules.minUsefulnessScoreForIndexing}`);
  } else if (!manualPromotion && !searchConsolePromotion) {
    reasons.push(
      `needs a usefulness score of ${rules.minUsefulnessScoreForIndexing}+ before indexing`
    );
  }

  if (manualPromotion) {
    signals.push(`manual-promotion:${manualPromotion.reason}`);
  }

  if (searchConsolePromotion) {
    signals.push(`search-console-promotion:${searchConsolePromotion.reason}`);
  }

  if (suppression) {
    reasons.push(`${suppression.source} suppression: ${suppression.reason}`);
  }

  const hardBlockers = reasons.filter(
    (reason) =>
      reason !== `needs a usefulness score of ${rules.minUsefulnessScoreForIndexing}+ before indexing` &&
      !reason.includes("suppression:")
  );
  const passesThreshold =
    usefulnessScore >= rules.minUsefulnessScoreForIndexing ||
    Boolean(manualPromotion) ||
    Boolean(searchConsolePromotion);
  const isIndexable = hardBlockers.length === 0 && passesThreshold && !suppression;
  const tier =
    !isIndexable
      ? "candidate"
      : manualPromotion?.tier === "core" ||
          searchConsolePromotion?.tier === "core" ||
          usefulnessScore >= rules.minUsefulnessScoreForCore
        ? "core"
        : "expanded";

  return {
    mode: isIndexable ? "index" : "noindex",
    sitemapEligible: isIndexable,
    stage: isIndexable ? "indexable" : "candidate",
    tier,
    usefulnessScore,
    reasons: uniqueStrings(reasons),
    signals: uniqueStrings(signals)
  };
}

export function scoreEntries(entries: Entry[], rules: IndexStatusRules = DEFAULT_INDEX_STATUS_RULES): Entry[] {
  return entries.map((entry) => {
    const qualityScore = computeQualityScore(entry);
    const nextEntry = {
      ...entry,
      qualityScore
    };

    return {
      ...nextEntry,
      indexStatus: computeIndexStatus(nextEntry, rules)
    };
  });
}
