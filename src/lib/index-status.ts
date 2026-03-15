import { AUDIO_CONFIDENCE_FLOOR, MIN_RELATED_LINKS_FOR_INDEXING } from "./constants";
import { isStableSlug } from "./slug";
import type { Entry, IndexStatus } from "../types/content";

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

export function computeIndexStatus(entry: Entry): IndexStatus {
  const reasons: string[] = [];

  if (!isStableSlug(entry.slug)) {
    reasons.push("slug is not stable");
  }

  if (entry.variants.length === 0) {
    reasons.push("missing pronunciation variants");
  }

  if (entry.glosses.length === 0) {
    reasons.push("missing gloss");
  }

  if (entry.provenance.length === 0) {
    reasons.push("missing provenance");
  }

  if (entry.related.length < MIN_RELATED_LINKS_FOR_INDEXING) {
    reasons.push("needs at least two useful internal links");
  }

  if (
    entry.variants.some(
      (variant) =>
        variant.audio.licenseStatus !== "clear" ||
        variant.audio.confidence < AUDIO_CONFIDENCE_FLOOR
    )
  ) {
    reasons.push("contains low-confidence audio or unresolved licensing");
  }

  if (
    entry.variants.every((variant) => variant.audio.kind === "synthetic") &&
    entry.bodyHtml.length === 0 &&
    entry.glosses.join(" ").length < 80
  ) {
    reasons.push("synthetic-only entry lacks enough supporting content");
  }

  return {
    mode: reasons.length === 0 ? "index" : "noindex",
    sitemapEligible: reasons.length === 0,
    reasons
  };
}

export function scoreEntries(entries: Entry[]): Entry[] {
  return entries.map((entry) => ({
    ...entry,
    qualityScore: computeQualityScore(entry),
    indexStatus: computeIndexStatus(entry)
  }));
}
