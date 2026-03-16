import path from "node:path";
import ts from "typescript";

import { PRE_RENDER_LIMIT } from "../constants";
import { materializePreviewAudio } from "./audio";
import { writeLearnIpaCurriculum } from "./learn-ipa";
import { originHubDefinitions, topicHubDefinitions } from "../hubs";
import { computeIndexStatus, scoreEntries } from "../index-status";
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
import { renderAttributionPage, type AttributionGroup } from "../../templates/attribution-page";
import { renderBrowsePage } from "../../templates/browse-page";
import { renderHomePage } from "../../templates/home-page";
import { renderHubPage } from "../../templates/hub-page";
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
  MERGED_CORPUS_PATH,
  NORMALIZED_SOURCES_PATH,
  PUBLIC_DIR,
  SCORED_CORPUS_PATH,
  SITE_MANIFEST_PATH
} from "./paths";
import {
  cleanBuildOutputs,
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
  const related = computeRelatedLinks(entries).map((entry) => ({
    ...entry,
    indexStatus: computeIndexStatus(entry)
  }));
  await writeJsonFile(LINKED_CORPUS_PATH, related);
  return related;
}

export async function runScoreStage(corpus?: Entry[]) {
  const entries = corpus ?? parseCorpus(await readJsonFile(LINKED_CORPUS_PATH));
  const scored = scoreEntries(entries);
  await writeJsonFile(SCORED_CORPUS_PATH, scored);
  await writeJsonFile(SITE_MANIFEST_PATH, {
    generatedAt: new Date().toISOString(),
    totalEntries: scored.length,
    topPages: sortEntries(scored)
      .slice(0, PRE_RENDER_LIMIT)
      .map((entry) => ({
        slug: entry.slug,
        display: entry.display,
        indexable: entry.indexStatus.sitemapEligible
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
    parseCorpus(
      await readJsonFile(AUDIO_READY_CORPUS_PATH).catch(async () => readJsonFile(SCORED_CORPUS_PATH))
    );
  const curriculum = await writeLearnIpaCurriculum(entries);
  await writeJsonFile(path.join(DIST_PUBLIC_DIR, "learn-ipa", "curriculum.json"), curriculum);
  await writeJsonFile(path.join(DIST_PUBLIC_DIR, "learn-ipa", "manifest.json"), {
    generatedAt: curriculum.generatedAt,
    version: curriculum.version,
    moduleCount: curriculum.modules.length,
    stepCount: curriculum.steps.length,
    symbolCount: curriculum.symbols.length,
    conceptCount: curriculum.concepts.length
  });
}

function countOrigins(entries: Entry[]): Array<{ slug: string; count: number }> {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.origin.sourceLanguage) {
      continue;
    }

    counts.set(entry.origin.sourceLanguage, (counts.get(entry.origin.sourceLanguage) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([slug, count]) => ({ slug: originHubDefinitions[slug] ? slug : slug, count }))
    .sort((left, right) => right.count - left.count || left.slug.localeCompare(right.slug));
}

function countTopics(entries: Entry[]): Array<{ slug: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const topic of entry.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((left, right) => right.count - left.count || left.slug.localeCompare(right.slug));
}

async function buildClientScript(): Promise<void> {
  const source = await readTextFile("src/client/audio-controls.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  });
  await writeTextFile(path.join(DIST_PUBLIC_DIR, "assets", "audio.js"), transpiled.outputText);
}

export async function runPrerenderStage(corpus?: Entry[]) {
  const entries =
    corpus ??
    parseCorpus(
      await readJsonFile(AUDIO_READY_CORPUS_PATH).catch(async () => readJsonFile(SCORED_CORPUS_PATH))
    );
  const config = buildSiteConfig(process.env);

  await ensureDir(DIST_PUBLIC_DIR);
  await copyPublicAssets(PUBLIC_DIR, DIST_PUBLIC_DIR);
  await buildClientScript();

  const featured = sortEntries(entries).slice(0, 9);
  const origins = countOrigins(entries);
  const topics = countTopics(entries);

  await writeRouteHtml(DIST_PUBLIC_DIR, "/", renderHomePage(featured, origins, topics, entries.length, config));
  await writeRouteHtml(DIST_PUBLIC_DIR, "/browse/", renderBrowsePage(sortEntries(entries), config));
  await writeRouteHtml(
    DIST_PUBLIC_DIR,
    "/origins/",
    renderHubPage(
      originHubDefinitions.root.title,
      originHubDefinitions.root.description,
      originHubDefinitions.root.intro,
      "/origins/",
      pickHubEntries(entries.filter((entry) => !!entry.origin.sourceLanguage)),
      config
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
      pickHubEntries(entries.filter((entry) => entry.topics.length > 0)),
      config
    )
  );

  for (const [slug, definition] of Object.entries(originHubDefinitions)) {
    if (slug === "root") {
      continue;
    }

    const hubEntries = entries.filter((entry) => entry.origin.sourceLanguage === slug);
    if (hubEntries.length === 0) {
      continue;
    }

    await writeRouteHtml(
      DIST_PUBLIC_DIR,
      `/origins/${slug}/`,
      renderHubPage(
        definition.title,
        definition.description,
        definition.intro,
        `/origins/${slug}/`,
        pickHubEntries(hubEntries),
        config
      )
    );
  }

  for (const [slug, definition] of Object.entries(topicHubDefinitions)) {
    if (slug === "root") {
      continue;
    }

    const hubEntries = entries.filter((entry) => entry.topics.includes(slug));
    if (hubEntries.length === 0) {
      continue;
    }

    await writeRouteHtml(
      DIST_PUBLIC_DIR,
      `/topics/${slug}/`,
      renderHubPage(
        definition.title,
        definition.description,
        definition.intro,
        `/topics/${slug}/`,
        pickHubEntries(hubEntries),
        config
      )
    );
  }

  const preRendered = sortEntries(entries)
    .filter((entry) => entry.indexStatus.sitemapEligible)
    .slice(0, PRE_RENDER_LIMIT);
  for (const entry of preRendered) {
    await writeRouteHtml(DIST_PUBLIC_DIR, `/w/${entry.slug}/`, renderWordPage(entry, config));
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

export function buildSitemapArtifacts(
  entries: Entry[],
  siteUrl: string
): Map<string, string> {
  const eligible = entries.filter((entry) => entry.indexStatus.sitemapEligible);
  const sitemapUrls: string[] = [];
  const files = new Map<string, string>();

  const coreUrls = sortEntries(eligible)
    .slice(0, PRE_RENDER_LIMIT)
    .map((entry) => `${siteUrl}/w/${entry.slug}`);
  files.set("sitemaps/core.xml", renderSitemap(coreUrls));
  sitemapUrls.push(`${siteUrl}/sitemaps/core.xml`);

  for (const origin of Object.keys(originHubDefinitions).filter((slug) => slug !== "root")) {
    const urls = eligible
      .filter((entry) => entry.origin.sourceLanguage === origin)
      .map((entry) => `${siteUrl}/w/${entry.slug}`);
    if (urls.length === 0) {
      continue;
    }
    files.set(`sitemaps/origins-${origin}.xml`, renderSitemap(urls));
    sitemapUrls.push(`${siteUrl}/sitemaps/origins-${origin}.xml`);
  }

  for (const topic of Object.keys(topicHubDefinitions).filter((slug) => slug !== "root")) {
    const urls = eligible
      .filter((entry) => entry.topics.includes(topic))
      .map((entry) => `${siteUrl}/w/${entry.slug}`);
    if (urls.length === 0) {
      continue;
    }
    files.set(`sitemaps/topics-${topic}.xml`, renderSitemap(urls));
    sitemapUrls.push(`${siteUrl}/sitemaps/topics-${topic}.xml`);
  }

  const expandedUrls = sortEntries(eligible)
    .slice(PRE_RENDER_LIMIT)
    .map((entry) => `${siteUrl}/w/${entry.slug}`);
  if (expandedUrls.length > 0) {
    files.set("sitemaps/expanded-1.xml", renderSitemap(expandedUrls));
    sitemapUrls.push(`${siteUrl}/sitemaps/expanded-1.xml`);
  }

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
  const files = buildSitemapArtifacts(entries, config.siteUrl);

  for (const [relativePath, contents] of files) {
    await writeTextFile(path.join(DIST_PUBLIC_DIR, relativePath), contents);
  }
}

function buildAttributionGroups(entries: Entry[]): AttributionGroup[] {
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
          entrySlugs: [entry.slug]
        });
      } else {
        current.entryCount += 1;
        if (!current.entrySlugs.includes(entry.slug)) {
          current.entrySlugs.push(entry.slug);
        }
      }
    }
  }

  return [...groups.values()].sort((left, right) => right.entryCount - left.entryCount);
}

export async function runAttributionStage(corpus?: Entry[]) {
  const entries =
    corpus ??
    parseCorpus(
      await readJsonFile(AUDIO_READY_CORPUS_PATH).catch(async () => readJsonFile(SCORED_CORPUS_PATH))
    );
  const config = buildSiteConfig(process.env);
  const groups = buildAttributionGroups(entries);
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceCount: groups.length,
    totalEntries: entries.length,
    groups
  };

  await writeJsonFile(ATTRIBUTION_MANIFEST_PATH, manifest);
  await writeTextFile(
    path.join(DIST_PUBLIC_DIR, "attribution", "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  await writeRouteHtml(
    DIST_PUBLIC_DIR,
    "/attribution/",
    renderAttributionPage(groups, "/attribution/manifest.json", config)
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
