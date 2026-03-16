import { loadGraduationRules } from "../../src/lib/build/graduation";
import { createIndexStatusRules, scoreEntries } from "../../src/lib/index-status";
import { applyOverride, mergeNormalizedEntries } from "../../src/lib/merge";
import { computeRelatedLinks } from "../../src/lib/related";
import { slugify } from "../../src/lib/slug";
import { importSources, loadOverrides, normalizeImportedSources } from "../../src/lib/build/sources";
import type { Entry } from "../../src/types/content";

let cachedCorpus: Entry[] | null = null;

export async function buildFixtureCorpus(): Promise<Entry[]> {
  if (cachedCorpus) {
    return cachedCorpus;
  }

  const imported = await importSources();
  const normalized = normalizeImportedSources(imported);
  const merged = mergeNormalizedEntries(normalized);
  const bySlug = new Map(merged.map((entry) => [entry.slug, entry]));

  for (const override of await loadOverrides()) {
    const slug = override.frontmatter.slug ?? slugify(override.frontmatter.word);
    const existing = bySlug.get(slug);
    if (!existing) {
      throw new Error(`Missing base entry for override ${slug}`);
    }

    bySlug.set(slug, applyOverride(existing, override.frontmatter, override.bodyHtml, override.path));
  }

  const graduationRules = await loadGraduationRules();
  cachedCorpus = scoreEntries(computeRelatedLinks([...bySlug.values()]), createIndexStatusRules(graduationRules));
  return cachedCorpus;
}
