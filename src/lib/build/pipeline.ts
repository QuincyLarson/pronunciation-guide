import path from "node:path";
import ts from "typescript";

import { PRE_RENDER_LIMIT, SITEMAP_CHUNK_SIZE } from "../constants";
import { materializePreviewAudio } from "./audio";
import { loadGraduationRules, writeGraduationManifest } from "./graduation";
import {
  LEARN_IPA_CURRICULUM_PATH,
  LEARN_IPA_LOOKUP_PATH,
  buildLearnIpaCurriculum,
  writeLearnIpaCurriculum
} from "./learn-ipa";
import {
  buildOriginHubStates,
  buildTopicHubStates,
  originHubDefinitions,
  topicHubDefinitions
} from "../hubs";
import { createIndexStatusRules, scoreEntries } from "../index-status";
import { buildLearnIpaLookup, getLearnIpaLinks } from "../learn-ipa/lookup";
import { applyOverride, mergeNormalizedEntries } from "../merge";
import { computeRelatedLinks } from "../related";
import { buildSiteConfig } from "../site-config";
import { getShardKey } from "../shards";
import { slugify } from "../slug";
import {
  corpusSchema,
  entrySchema,
  normalizedSourceEntrySchema,
  shardFileSchema,
  type Entry
} from "../../types/content";
import { learnCurriculumSchema } from "../../types/learn-ipa";
import { renderAttributionPage, type AttributionGroup } from "../../templates/attribution-page";
import { renderBrowsePage } from "../../templates/browse-page";
import { renderHomePage } from "../../templates/home-page";
import { renderHubPage } from "../../templates/hub-page";
import { renderLearnIpaAboutPage } from "../../templates/learn-ipa-about-page";
import { renderLearnIpaModulePage } from "../../templates/learn-ipa-module-page";
import { renderLearnIpaPage } from "../../templates/learn-ipa-page";
import { renderLearnIpaReferencePage } from "../../templates/learn-ipa-reference-page";
import { renderNotFoundPage } from "../../templates/not-found-page";
import { renderWordPage } from "../../templates/word-page";
import {
  ATTRIBUTION_MANIFEST_PATH,
  AUDIO_READY_CORPUS_PATH,
  DIST_PUBLIC_DIR,
  DIST_SHARDS_DIR,
  GENERATED_SHARDS_DIR,
  IMPORTED_SOURCES_PATH,
  LINKED_CORPUS_PATH,
  LICENSE_MANIFEST_PATH,
  MERGED_CORPUS_PATH,
  NORMALIZED_SOURCES_PATH,
  PROJECT_ROOT,
  PUBLIC_DIR,
  SCORED_CORPUS_PATH,
  SITE_MANIFEST_PATH
} from "./paths";
import {
  cleanBuildOutputs,
  collectFiles,
  copyPublicAssets,
  ensureDir,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeRouteHtml,
  writeTextFile
} from "./io";
import {
  importedSourcesSchema,
  importSources,
  loadOverrides,
  normalizeImportedSources,
  parseCorpus
} from "./sources";

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (left, right) => right.qualityScore - left.qualityScore || right.searchRank - left.searchRank
  );
}

function pickHubEntries(entries: Entry[]): Entry[] {
  return sortEntries(entries).slice(0, 12);
}

function groupBy<T>(values: T[], getKey: (value: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const value of values) {
    const key = getKey(value);
    const current = grouped.get(key) ?? [];
    current.push(value);
    grouped.set(key, current);
  }

  return grouped;
}

export async function loadFirstAvailableCorpus(stagePaths: string[]): Promise<Entry[]> {
  const failures: string[] = [];

  for (const stagePath of stagePaths) {
    try {
      return parseCorpus(await readJsonFile(stagePath));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${path.relative(PROJECT_ROOT, stagePath)}: ${reason}`);
    }
  }

  throw new Error(`Could not load a readable corpus stage. Tried ${failures.join(" | ")}`);
}

export async function runImportStage() {
  const imported = await importSources();
  await writeJsonFile(IMPORTED_SOURCES_PATH, imported);
  return imported;
}

export async function runNormalizeStage(imported?: Awaited<ReturnType<typeof runImportStage>>) {
  const importedSources =
    imported ?? importedSourcesSchema.parse(await readJsonFile(IMPORTED_SOURCES_PATH));
  const normalized = normalizeImportedSources(importedSources);
  await writeJsonFile(NORMALIZED_SOURCES_PATH, normalized);
  return normalized;
}

export async function runMergeStage(normalized?: Awaited<ReturnType<typeof runNormalizeStage>>) {
  const normalizedEntries =
    normalized ??
    normalizedSourceEntrySchema.array().parse(await readJsonFile(NORMALIZED_SOURCES_PATH));
  const merged = mergeNormalizedEntries(normalizedEntries);
  const overrides = await loadOverrides();
  const bySlug = new Map(merged.map((entry) => [entry.slug, entry]));

  for (const override of overrides) {
      const slug = override.frontmatter.slug ?? slugify(override.frontmatter.word);
    const existing = bySlug.get(slug) ?? entrySchema.parse({
      id: `${override.frontmatter.language}:${slug}`,
      slug,
      display: override.frontmatter.display ?? override.frontmatter.word,
      language: override.frontmatter.language,
      pos: [],
      glosses: [],
      shortGloss: null,
      origin: {},
      topics: [],
      variants: [],
      related: [],
      relatedSeedSlugs: [],
      semanticLinkSlugs: [],
      confusions: [],
      confusionNotes: [],
      provenance: [],
      qualityScore: override.frontmatter.quality_boost,
      indexStatus: {
        mode: "noindex",
        sitemapEligible: false,
        reasons: ["override created placeholder entry"]
      },
      searchRank: 0,
      badges: [],
      bodyHtml: "",
      licenseNotes: [],
      reviewers: []
    });

    bySlug.set(slug, applyOverride(existing, override.frontmatter, override.bodyHtml, override.path));
  }

  const result = [...bySlug.values()];
  await writeJsonFile(MERGED_CORPUS_PATH, result);
  return result;
}

export async function runRelatedStage(corpus?: Entry[]) {
  const entries = corpus ?? parseCorpus(await readJsonFile(MERGED_CORPUS_PATH));
  const related = computeRelatedLinks(entries);
  await writeJsonFile(LINKED_CORPUS_PATH, related);
  return related;
}

export async function runScoreStage(corpus?: Entry[]) {
  const entries = corpus ?? parseCorpus(await readJsonFile(LINKED_CORPUS_PATH));
  const graduationRules = await loadGraduationRules();
  const scored = scoreEntries(entries, createIndexStatusRules(graduationRules));
  const graduationManifest = await writeGraduationManifest(scored, graduationRules);
  await writeJsonFile(SCORED_CORPUS_PATH, scored);
  await writeJsonFile(SITE_MANIFEST_PATH, {
    generatedAt: new Date().toISOString(),
    totalEntries: scored.length,
    indexableEntries: graduationManifest.counts.indexable,
    candidateEntries: graduationManifest.counts.candidate,
    coreEntries: graduationManifest.counts.core,
    expandedEntries: graduationManifest.counts.expanded,
    topPages: sortEntries(scored)
      .slice(0, PRE_RENDER_LIMIT)
      .map((entry) => ({
        slug: entry.slug,
        display: entry.display,
        indexable: entry.indexStatus.sitemapEligible,
        tier: entry.indexStatus.tier
      }))
  });
  return scored;
}

export async function runAudioStage(corpus?: Entry[]) {
  const entries = corpus ?? parseCorpus(await readJsonFile(SCORED_CORPUS_PATH));
  const audioReady = await materializePreviewAudio(entries);
  await writeJsonFile(AUDIO_READY_CORPUS_PATH, audioReady);
  return audioReady;
}

function buildShardMap(entries: Entry[]): Map<string, Entry[]> {
  return groupBy(entries, (entry) => `${entry.language}:${getShardKey(entry.slug)}`);
}

export async function runShardStage(corpus?: Entry[]) {
  const entries =
    corpus ??
    parseCorpus(
      await readJsonFile(AUDIO_READY_CORPUS_PATH).catch(async () => readJsonFile(SCORED_CORPUS_PATH))
    );
  const shardMap = buildShardMap(entries);

  for (const [compoundKey, shardEntries] of shardMap.entries()) {
    const [language, shard] = compoundKey.split(":");
    const shardFile = shardFileSchema.parse({
      language,
      shard,
      entries: sortEntries(shardEntries)
    });
    await writeJsonFile(path.join(GENERATED_SHARDS_DIR, language, `${shard}.json`), shardFile);
    await writeJsonFile(path.join(DIST_SHARDS_DIR, language, `${shard}.json`), shardFile);
  }
}

export async function runLearnIpaStage(corpus?: Entry[]) {
  const entries =
    corpus ??
    (await loadFirstAvailableCorpus([
      AUDIO_READY_CORPUS_PATH,
      SCORED_CORPUS_PATH,
      LINKED_CORPUS_PATH,
      MERGED_CORPUS_PATH
    ]));
  const curriculum = await writeLearnIpaCurriculum(entries);
  const lookup = buildLearnIpaLookup(curriculum);
  await writeJsonFile(LEARN_IPA_LOOKUP_PATH, lookup);
  await writeJsonFile(path.join(DIST_PUBLIC_DIR, "learn-ipa", "curriculum.json"), curriculum);
  await writeJsonFile(path.join(DIST_PUBLIC_DIR, "learn-ipa", "lookup.json"), lookup);
  await writeJsonFile(path.join(DIST_PUBLIC_DIR, "learn-ipa", "manifest.json"), {
    generatedAt: curriculum.generatedAt,
    version: curriculum.version,
    moduleCount: curriculum.modules.length,
    stepCount: curriculum.steps.length,
    symbolCount: curriculum.symbols.length,
    conceptCount: curriculum.concepts.length
  });
}

function countOrigins(
  entries: Entry[],
  minIndexableEntries: number
): Array<{ slug: string; count: number }> {
  return buildOriginHubStates(entries, minIndexableEntries).map((state) => ({
    slug: state.slug,
    count: state.indexableEntries
  }));
}

function countTopics(entries: Entry[], minIndexableEntries: number): Array<{ slug: string; count: number }> {
  return buildTopicHubStates(entries, minIndexableEntries).map((state) => ({
    slug: state.slug,
    count: state.indexableEntries
  }));
}

async function buildClientScript(): Promise<void> {
  const browserSafeRoots = [
    path.join(PROJECT_ROOT, "src", "client"),
    path.join(PROJECT_ROOT, "src", "lib", "learn-ipa")
  ];

  for (const root of browserSafeRoots) {
    const files = await collectFiles(root, ".ts");

    for (const filePath of files) {
      const source = await readTextFile(filePath);
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022
        }
      });
      const relativePath = path.relative(path.join(PROJECT_ROOT, "src"), filePath).replace(/\.ts$/, ".js");
      const output = transpiled.outputText;
      await writeTextFile(path.join(DIST_PUBLIC_DIR, "assets", relativePath), output);

      if (relativePath === path.join("client", "learn-ipa", "sw.js")) {
        await writeTextFile(path.join(DIST_PUBLIC_DIR, "learn-ipa", "sw.js"), output);
      }
    }
  }
}

export async function runPrerenderStage(corpus?: Entry[]) {
  const entries =
    corpus ??
    parseCorpus(
      await readJsonFile(AUDIO_READY_CORPUS_PATH).catch(async () => readJsonFile(SCORED_CORPUS_PATH))
    );
  const learnCurriculum = await readJsonFile(LEARN_IPA_CURRICULUM_PATH)
    .then((value) => learnCurriculumSchema.parse(value))
    .catch(async () => buildLearnIpaCurriculum(entries));
  const learnLookup = buildLearnIpaLookup(learnCurriculum);
  const config = buildSiteConfig(process.env);
  const graduationRules = await loadGraduationRules();
  const originHubStates = buildOriginHubStates(
    entries,
    graduationRules.metadataThresholds.minIndexableEntriesPerHub
  );
  const topicHubStates = buildTopicHubStates(
    entries,
    graduationRules.metadataThresholds.minIndexableEntriesPerHub
  );

  await ensureDir(DIST_PUBLIC_DIR);
  await copyPublicAssets(PUBLIC_DIR, DIST_PUBLIC_DIR);
  await buildClientScript();

  const featured = sortEntries(entries.filter((entry) => entry.indexStatus.sitemapEligible)).slice(0, 9);
  const origins = countOrigins(entries, graduationRules.metadataThresholds.minIndexableEntriesPerHub);
  const topics = countTopics(entries, graduationRules.metadataThresholds.minIndexableEntriesPerHub);

  await writeRouteHtml(DIST_PUBLIC_DIR, "/", renderHomePage(featured, origins, topics, entries.length, config));
  await writeRouteHtml(DIST_PUBLIC_DIR, "/browse/", renderBrowsePage(sortEntries(entries), config));
  await writeRouteHtml(DIST_PUBLIC_DIR, "/learn-ipa/", renderLearnIpaPage(learnCurriculum, config));
  await writeRouteHtml(
    DIST_PUBLIC_DIR,
    "/learn-ipa/reference/",
    renderLearnIpaReferencePage(learnCurriculum, config)
  );
  await writeRouteHtml(DIST_PUBLIC_DIR, "/learn-ipa/about/", renderLearnIpaAboutPage(learnCurriculum, config));

  for (const module of learnCurriculum.modules) {
    await writeRouteHtml(
      DIST_PUBLIC_DIR,
      `/learn-ipa/module/${module.slug}/`,
      renderLearnIpaModulePage(learnCurriculum, module, config)
    );
  }

  await writeRouteHtml(
    DIST_PUBLIC_DIR,
    "/origins/",
    renderHubPage(
      originHubDefinitions.root.title,
      originHubDefinitions.root.description,
      originHubDefinitions.root.intro,
      "/origins/",
      pickHubEntries(entries.filter((entry) => !!entry.origin.sourceLanguage && entry.indexStatus.sitemapEligible)),
      config,
      {
        totalEntries: originHubStates.reduce((sum, state) => sum + state.totalEntries, 0),
        indexableEntries: originHubStates.reduce((sum, state) => sum + state.indexableEntries, 0)
      }
    )
  );
  await writeRouteHtml(
    DIST_PUBLIC_DIR,
    "/topics/",
    renderHubPage(
      topicHubDefinitions.root.title,
      topicHubDefinitions.root.description,
      topicHubDefinitions.root.intro,
      "/topics/",
      pickHubEntries(entries.filter((entry) => entry.topics.length > 0 && entry.indexStatus.sitemapEligible)),
      config,
      {
        totalEntries: topicHubStates.reduce((sum, state) => sum + state.totalEntries, 0),
        indexableEntries: topicHubStates.reduce((sum, state) => sum + state.indexableEntries, 0)
      }
    )
  );

  for (const hub of originHubStates) {
    const hubEntries = entries.filter((entry) => entry.origin.sourceLanguage === hub.slug);
    await writeRouteHtml(
      DIST_PUBLIC_DIR,
      hub.path,
      renderHubPage(
        hub.title,
        hub.description,
        hub.intro,
        hub.path,
        pickHubEntries(hubEntries.filter((entry) => entry.indexStatus.sitemapEligible || !hub.indexable)),
        config,
        {
          robots: hub.indexable ? "index,follow" : "noindex,follow",
          totalEntries: hub.totalEntries,
          indexableEntries: hub.indexableEntries
        }
      )
    );
  }

  for (const hub of topicHubStates) {
    const hubEntries = entries.filter((entry) => entry.topics.includes(hub.slug));
    await writeRouteHtml(
      DIST_PUBLIC_DIR,
      hub.path,
      renderHubPage(
        hub.title,
        hub.description,
        hub.intro,
        hub.path,
        pickHubEntries(hubEntries.filter((entry) => entry.indexStatus.sitemapEligible || !hub.indexable)),
        config,
        {
          robots: hub.indexable ? "index,follow" : "noindex,follow",
          totalEntries: hub.totalEntries,
          indexableEntries: hub.indexableEntries
        }
      )
    );
  }

  const preRendered = sortEntries(entries)
    .filter((entry) => entry.indexStatus.sitemapEligible)
    .slice(0, PRE_RENDER_LIMIT);
  for (const entry of preRendered) {
    await writeRouteHtml(
      DIST_PUBLIC_DIR,
      `/w/${entry.slug}/`,
      renderWordPage(entry, config, getLearnIpaLinks(entry, learnLookup))
    );
  }

  await writeTextFile(
    path.join(DIST_PUBLIC_DIR, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`
  );
  await writeTextFile(path.join(DIST_PUBLIC_DIR, "404.html"), renderNotFoundPage(config));
}

function renderSitemap(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${url}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
}

function renderSitemapIndex(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <sitemap><loc>${url}</loc></sitemap>`)
    .join("\n")}\n</sitemapindex>\n`;
}

function chunkUrls(urls: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < urls.length; index += size) {
    chunks.push(urls.slice(index, index + size));
  }
  return chunks;
}

function buildLearnIpaSitemapUrls(
  learnCurriculum: Awaited<ReturnType<typeof buildLearnIpaCurriculum>>,
  siteUrl: string
): string[] {
  return [
    `${siteUrl}/learn-ipa`,
    `${siteUrl}/learn-ipa/reference`,
    `${siteUrl}/learn-ipa/about`,
    ...learnCurriculum.modules.map((module) => `${siteUrl}/learn-ipa/module/${module.slug}`)
  ];
}

export async function buildSitemapArtifacts(
  entries: Entry[],
  siteUrl: string
): Promise<Map<string, string>> {
  const eligible = entries.filter((entry) => entry.indexStatus.sitemapEligible);
  const graduationRules = await loadGraduationRules();
  const originHubStates = buildOriginHubStates(
    entries,
    graduationRules.metadataThresholds.minIndexableEntriesPerHub
  );
  const topicHubStates = buildTopicHubStates(
    entries,
    graduationRules.metadataThresholds.minIndexableEntriesPerHub
  );
  const learnCurriculum = await readJsonFile(LEARN_IPA_CURRICULUM_PATH)
    .then((value) => learnCurriculumSchema.parse(value))
    .catch(async () => buildLearnIpaCurriculum(entries));
  const sitemapUrls: string[] = [];
  const files = new Map<string, string>();

  const coreUrls = [
    `${siteUrl}/`,
    `${siteUrl}/browse/`,
    `${siteUrl}/origins/`,
    `${siteUrl}/topics/`,
    `${siteUrl}/attribution/`,
    ...sortEntries(eligible.filter((entry) => entry.indexStatus.tier === "core"))
      .slice(0, PRE_RENDER_LIMIT * 2)
      .map((entry) => `${siteUrl}/w/${entry.slug}`)
  ];
  files.set("sitemaps/core.xml", renderSitemap([...new Set(coreUrls)]));
  sitemapUrls.push(`${siteUrl}/sitemaps/core.xml`);

  const originHubUrls = [
    `${siteUrl}/origins/`,
    ...originHubStates.filter((hub) => hub.indexable).map((hub) => `${siteUrl}${hub.path}`)
  ];
  files.set("sitemaps/hubs-origins.xml", renderSitemap(originHubUrls));
  sitemapUrls.push(`${siteUrl}/sitemaps/hubs-origins.xml`);

  const topicHubUrls = [
    `${siteUrl}/topics/`,
    ...topicHubStates.filter((hub) => hub.indexable).map((hub) => `${siteUrl}${hub.path}`)
  ];
  files.set("sitemaps/hubs-topics.xml", renderSitemap(topicHubUrls));
  sitemapUrls.push(`${siteUrl}/sitemaps/hubs-topics.xml`);

  const expandedUrls = sortEntries(eligible)
    .filter((entry) => entry.indexStatus.tier !== "core")
    .map((entry) => `${siteUrl}/w/${entry.slug}`);
  for (const [index, urls] of chunkUrls(expandedUrls, SITEMAP_CHUNK_SIZE).entries()) {
    const relativePath = `sitemaps/words-expanded-${index + 1}.xml`;
    files.set(relativePath, renderSitemap(urls));
    sitemapUrls.push(`${siteUrl}/${relativePath}`);
  }

  const learnUrls = buildLearnIpaSitemapUrls(learnCurriculum, siteUrl);
  files.set("sitemaps/learn-ipa.xml", renderSitemap(learnUrls));
  sitemapUrls.push(`${siteUrl}/sitemaps/learn-ipa.xml`);

  files.set("sitemap.xml", renderSitemapIndex(sitemapUrls));
  return files;
}

export async function runSitemapStage(corpus?: Entry[]) {
  const entries =
    corpus ??
    parseCorpus(
      await readJsonFile(AUDIO_READY_CORPUS_PATH).catch(async () => readJsonFile(SCORED_CORPUS_PATH))
    );
  const config = buildSiteConfig(process.env);
  const files = await buildSitemapArtifacts(entries, config.siteUrl);

  for (const [relativePath, contents] of files) {
    await writeTextFile(path.join(DIST_PUBLIC_DIR, relativePath), contents);
  }
}

export function buildAttributionGroups(entries: Entry[]): AttributionGroup[] {
  const groups = new Map<string, AttributionGroup>();

  for (const entry of entries) {
    for (const provenance of entry.provenance) {
      const key = `${provenance.sourceName}:${provenance.sourceLicense}`;
      const current = groups.get(key);
      if (!current) {
        groups.set(key, {
          sourceName: provenance.sourceName,
          sourceUrl: provenance.sourceUrl,
          sourceLicense: provenance.sourceLicense,
          attributionText: provenance.attributionText,
          entryCount: 1,
          entrySlugs: [entry.slug],
          fields: [...new Set(provenance.fields)].sort(),
          audioVariantCount: entry.variants.filter((variant) =>
            variant.provenanceIds.includes(provenance.id)
          ).length
        });
      } else {
        if (!current.entrySlugs.includes(entry.slug)) {
          current.entryCount += 1;
          current.entrySlugs.push(entry.slug);
        }
        current.fields = [...new Set([...current.fields, ...provenance.fields])].sort();
        current.audioVariantCount += entry.variants.filter((variant) =>
          variant.provenanceIds.includes(provenance.id)
        ).length;
      }
    }
  }

  return [...groups.values()].sort((left, right) => right.entryCount - left.entryCount);
}

export function buildLicenseManifest(entries: Entry[], groups: AttributionGroup[]) {
  const byLicense = new Map<
    string,
    {
      license: string;
      sourceNames: string[];
      entrySlugs: string[];
      fields: string[];
      audioVariantCount: number;
    }
  >();
  const audioLicenses = new Map<
    string,
    {
      license: string;
      variantCount: number;
      entrySlugs: string[];
      engineIds: string[];
      statusCounts: Record<"clear" | "review-needed" | "blocked", number>;
    }
  >();

  for (const group of groups) {
    const current = byLicense.get(group.sourceLicense);
    if (!current) {
      byLicense.set(group.sourceLicense, {
        license: group.sourceLicense,
        sourceNames: [group.sourceName],
        entrySlugs: [...group.entrySlugs],
        fields: [...group.fields],
        audioVariantCount: group.audioVariantCount
      });
      continue;
    }

    current.sourceNames = [...new Set([...current.sourceNames, group.sourceName])].sort();
    current.entrySlugs = [...new Set([...current.entrySlugs, ...group.entrySlugs])].sort();
    current.fields = [...new Set([...current.fields, ...group.fields])].sort();
    current.audioVariantCount += group.audioVariantCount;
  }

  for (const entry of entries) {
    for (const variant of entry.variants) {
      const license = variant.audio.license ?? "unspecified";
      const current = audioLicenses.get(license);
      if (!current) {
        audioLicenses.set(license, {
          license,
          variantCount: 1,
          entrySlugs: [entry.slug],
          engineIds: variant.audio.engine ? [variant.audio.engine] : [],
          statusCounts: {
            clear: variant.audio.licenseStatus === "clear" ? 1 : 0,
            "review-needed": variant.audio.licenseStatus === "review-needed" ? 1 : 0,
            blocked: variant.audio.licenseStatus === "blocked" ? 1 : 0
          }
        });
        continue;
      }

      current.variantCount += 1;
      current.entrySlugs = [...new Set([...current.entrySlugs, entry.slug])].sort();
      current.engineIds = [
        ...new Set([...current.engineIds, ...(variant.audio.engine ? [variant.audio.engine] : [])])
      ].sort();
      current.statusCounts[variant.audio.licenseStatus] += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceCount: groups.length,
    licenseCount: byLicense.size,
    licenses: [...byLicense.values()]
      .map((license) => ({
        ...license,
        sourceCount: license.sourceNames.length,
        entryCount: license.entrySlugs.length
      }))
      .sort((left, right) => right.entryCount - left.entryCount || left.license.localeCompare(right.license)),
    audioLicenses: [...audioLicenses.values()].sort(
      (left, right) => right.variantCount - left.variantCount || left.license.localeCompare(right.license)
    )
  };
}

export async function runAttributionStage(corpus?: Entry[]) {
  const entries =
    corpus ??
    parseCorpus(
      await readJsonFile(AUDIO_READY_CORPUS_PATH).catch(async () => readJsonFile(SCORED_CORPUS_PATH))
    );
  const config = buildSiteConfig(process.env);
  const groups = buildAttributionGroups(entries);
  const licenseManifest = buildLicenseManifest(entries, groups);
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceCount: groups.length,
    totalEntries: entries.length,
    groups
  };

  await writeJsonFile(ATTRIBUTION_MANIFEST_PATH, manifest);
  await writeJsonFile(LICENSE_MANIFEST_PATH, licenseManifest);
  await writeTextFile(
    path.join(DIST_PUBLIC_DIR, "attribution", "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  await writeTextFile(
    path.join(DIST_PUBLIC_DIR, "attribution", "license-manifest.json"),
    `${JSON.stringify(licenseManifest, null, 2)}\n`
  );
  await writeRouteHtml(
    DIST_PUBLIC_DIR,
    "/attribution/",
    renderAttributionPage(
      groups,
      "/attribution/manifest.json",
      "/attribution/license-manifest.json",
      config
    )
  );
}

export async function runBuild(): Promise<void> {
  await cleanBuildOutputs();
  const imported = await runImportStage();
  const normalized = await runNormalizeStage(imported);
  const merged = await runMergeStage(normalized);
  const related = await runRelatedStage(merged);
  const scored = await runScoreStage(related);
  const audioReady = await runAudioStage(scored);
  await runShardStage(audioReady);
  await runLearnIpaStage(audioReady);
  await runPrerenderStage(audioReady);
  await runSitemapStage(audioReady);
  await runAttributionStage(audioReady);
}

export async function readMergedCorpus(): Promise<Entry[]> {
  return corpusSchema.parse(await readJsonFile(MERGED_CORPUS_PATH));
}

export async function readLinkedCorpus(): Promise<Entry[]> {
  return corpusSchema.parse(await readJsonFile(LINKED_CORPUS_PATH));
}

export async function readScoredCorpus(): Promise<Entry[]> {
  return corpusSchema.parse(await readJsonFile(SCORED_CORPUS_PATH));
}
