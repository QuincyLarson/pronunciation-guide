import { INDEX_GRADUATION_MANIFEST_PATH, INDEXING_RULES_PATH } from "./paths";
import { readJsonFile, writeJsonFile } from "./io";
import type { Entry } from "../../types/content";
import {
  graduationManifestSchema,
  graduationRulesSchema,
  type GraduationManifest,
  type GraduationRules
} from "../../types/graduation";

const DEFAULT_GRADUATION_RULES = graduationRulesSchema.parse({});

export async function loadGraduationRules(): Promise<GraduationRules> {
  try {
    return graduationRulesSchema.parse(await readJsonFile(INDEXING_RULES_PATH));
  } catch {
    return DEFAULT_GRADUATION_RULES;
  }
}

export function buildGraduationManifest(
  entries: Entry[],
  rules: GraduationRules
): GraduationManifest {
  const promoted = entries
    .filter((entry) => entry.indexStatus.stage === "indexable")
    .map((entry) => ({
      slug: entry.slug,
      display: entry.display,
      stage: entry.indexStatus.stage,
      tier: entry.indexStatus.tier,
      usefulnessScore: entry.indexStatus.usefulnessScore,
      reasons: entry.indexStatus.reasons,
      signals: entry.indexStatus.signals
    }))
    .sort(
      (left, right) =>
        right.usefulnessScore - left.usefulnessScore || left.slug.localeCompare(right.slug)
    );
  const candidates = entries
    .filter((entry) => entry.indexStatus.stage === "candidate")
    .map((entry) => ({
      slug: entry.slug,
      display: entry.display,
      stage: entry.indexStatus.stage,
      tier: entry.indexStatus.tier,
      usefulnessScore: entry.indexStatus.usefulnessScore,
      reasons: entry.indexStatus.reasons,
      signals: entry.indexStatus.signals
    }))
    .sort(
      (left, right) =>
        right.usefulnessScore - left.usefulnessScore || left.slug.localeCompare(right.slug)
    );

  return graduationManifestSchema.parse({
    generatedAt: new Date().toISOString(),
    thresholds: rules.metadataThresholds,
    counts: {
      candidate: candidates.length,
      indexable: promoted.length,
      core: promoted.filter((entry) => entry.tier === "core").length,
      expanded: promoted.filter((entry) => entry.tier === "expanded").length
    },
    promoted,
    candidates,
    manualPromotions: rules.manual.promote,
    searchConsolePromotions: rules.searchConsole.promote,
    suppressions: [...rules.manual.suppress, ...rules.searchConsole.suppress]
  });
}

export async function writeGraduationManifest(
  entries: Entry[],
  rules: GraduationRules
): Promise<GraduationManifest> {
  const manifest = buildGraduationManifest(entries, rules);
  await writeJsonFile(INDEX_GRADUATION_MANIFEST_PATH, manifest);
  return manifest;
}
