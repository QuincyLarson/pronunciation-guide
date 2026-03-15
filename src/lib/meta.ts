import type { Entry } from "../types/content";

export function buildWordTitle(entry: Entry, siteTitleSuffix: string): string {
  return `${entry.display} pronunciation, audio, IPA, and variants | ${siteTitleSuffix}`;
}

export function buildWordDescription(entry: Entry): string {
  const gloss = entry.shortGloss ?? entry.glosses[0] ?? "Hear the pronunciation and compare variants.";
  const labels = entry.variants.map((variant) => variant.label).join(", ");
  return `${entry.display}: ${gloss} Variants: ${labels}.`;
}
