import path from "node:path";
import { createHash } from "node:crypto";
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";

import type { Entry, PronunciationVariant } from "../../types/content";
import { createSayAudioEngine, choosePreviewSpeechText, chooseSayVoice, isFixturePreviewAudio, type AudioGenerationEngine, type AudioGenerationInput } from "./audio-engine";
import {
  AUDIO_CACHE_DIR,
  AUDIO_MANIFEST_PATH,
  DIST_AUDIO_DIR,
  DIST_PUBLIC_DIR
} from "./paths";
import { ensureDir, writeJsonFile } from "./io";

export { choosePreviewSpeechText, chooseSayVoice, isFixturePreviewAudio };

type AudioJobStatus = "passthrough" | "generated" | "skipped" | "failed";

interface AudioCacheMetadata {
  cacheKey: string;
  engineId: string;
  inputKind: string;
  inputValue: string;
  failed?: boolean;
}

interface AudioJobManifest {
  entrySlug: string;
  variantId: string;
  locale: string;
  kind: string;
  status: AudioJobStatus;
  engineId: string | null;
  inputKind: string | null;
  inputValue: string | null;
  sourcePath: string;
  outputPath: string | null;
  cacheKey: string | null;
  reviewFlags: string[];
  qualityFlags: string[];
}

interface AudioManifest {
  generatedAt: string;
  engineIds: string[];
  jobCount: number;
  jobs: AudioJobManifest[];
}

const DEFAULT_ENGINES: AudioGenerationEngine[] = [createSayAudioEngine()];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function hashJobInput(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 12);
}

function audioExtensionForMimeType(mimeType: string): string {
  if (mimeType === "audio/mpeg") {
    return "mp3";
  }
  if (mimeType === "audio/ogg") {
    return "ogg";
  }
  return "wav";
}

function buildGeneratedOutputPath(
  entry: Entry,
  variant: PronunciationVariant,
  engine: AudioGenerationEngine,
  cacheKey: string
): { relative: string; absolute: string; cache: string; cacheMeta: string } {
  const extension = audioExtensionForMimeType(engine.mimeType);
  const fileName = `${variant.id}-${engine.id}-${cacheKey}.${extension}`;
  const relative = `/audio/generated/${entry.slug}/${fileName}`;

  return {
    relative,
    absolute: path.join(DIST_AUDIO_DIR, "generated", entry.slug, fileName),
    cache: path.join(AUDIO_CACHE_DIR, entry.slug, fileName),
    cacheMeta: path.join(AUDIO_CACHE_DIR, entry.slug, `${fileName}.json`)
  };
}

async function audioFileLooksUsable(filePath: string): Promise<boolean> {
  try {
    const details = await stat(filePath);
    return details.size > 4096;
  } catch {
    return false;
  }
}

async function readCacheMetadata(filePath: string): Promise<AudioCacheMetadata | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as AudioCacheMetadata;
  } catch {
    return null;
  }
}

function selectEngine(
  entry: Entry,
  variant: PronunciationVariant,
  engines: AudioGenerationEngine[]
): { engine: AudioGenerationEngine; input: AudioGenerationInput } | null {
  const requestedEngine = variant.audio.engine;
  const candidates = requestedEngine
    ? engines.filter((engine) => engine.id === requestedEngine)
    : engines;

  for (const engine of candidates) {
    const input = engine.pickInput(entry, variant);
    if (input) {
      return { engine, input };
    }
  }

  return null;
}

async function restoreOrGenerateAudio(
  engine: AudioGenerationEngine,
  variant: PronunciationVariant,
  output: ReturnType<typeof buildGeneratedOutputPath>,
  cacheKey: string,
  input: AudioGenerationInput
): Promise<AudioJobStatus> {
  await ensureDir(path.dirname(output.cache));
  await ensureDir(path.dirname(output.absolute));

  const cacheMetadata = await readCacheMetadata(output.cacheMeta);
  const cacheMatches =
    cacheMetadata?.cacheKey === cacheKey &&
    cacheMetadata.engineId === engine.id &&
    cacheMetadata.inputKind === input.kind &&
    cacheMetadata.inputValue === input.value;

  if (cacheMatches && !cacheMetadata?.failed && (await audioFileLooksUsable(output.cache))) {
    await copyFile(output.cache, output.absolute);
    return "generated";
  }

  if (!engine.canRun()) {
    return "skipped";
  }

  try {
    await engine.generate(output.cache, variant, input);
    const usable = await audioFileLooksUsable(output.cache);
    await writeFile(
      output.cacheMeta,
      `${JSON.stringify(
        {
          cacheKey,
          engineId: engine.id,
          inputKind: input.kind,
          inputValue: input.value,
          failed: !usable
        } satisfies AudioCacheMetadata,
        null,
        2
      )}\n`,
      "utf8"
    );

    if (!usable) {
      return "failed";
    }

    await copyFile(output.cache, output.absolute);
    return "generated";
  } catch {
    await writeFile(
      output.cacheMeta,
      `${JSON.stringify(
        {
          cacheKey,
          engineId: engine.id,
          inputKind: input.kind,
          inputValue: input.value,
          failed: true
        } satisfies AudioCacheMetadata,
        null,
        2
      )}\n`,
      "utf8"
    );
    return "failed";
  }
}

function buildPassthroughResult(
  entry: Entry,
  variant: PronunciationVariant,
  status: AudioJobStatus
): { variant: PronunciationVariant; job: AudioJobManifest } {
  const qualityFlags = uniqueStrings([
    ...variant.audio.qualityFlags,
    variant.audio.kind === "human" ? "human-passthrough" : "prebuilt-audio"
  ]);

  return {
    variant: {
      ...variant,
      audio: {
        ...variant.audio,
        qualityFlags
      }
    },
    job: {
      entrySlug: entry.slug,
      variantId: variant.id,
      locale: variant.locale,
      kind: variant.audio.kind,
      status,
      engineId: variant.audio.engine,
      inputKind: null,
      inputValue: null,
      sourcePath: variant.audio.src,
      outputPath: variant.audio.src,
      cacheKey: null,
      reviewFlags: variant.audio.reviewFlags,
      qualityFlags
    }
  };
}

async function processVariantAudio(
  entry: Entry,
  variant: PronunciationVariant,
  engines: AudioGenerationEngine[]
): Promise<{ variant: PronunciationVariant; job: AudioJobManifest }> {
  if (!isFixturePreviewAudio(variant.audio.src) && variant.audio.kind === "human") {
    return buildPassthroughResult(entry, variant, "passthrough");
  }

  if (!isFixturePreviewAudio(variant.audio.src) && variant.audio.kind === "synthetic" && !variant.audio.engine) {
    return buildPassthroughResult(entry, variant, "passthrough");
  }

  const selected = selectEngine(entry, variant, engines);
  if (!selected) {
    const reviewFlags = uniqueStrings([...variant.audio.reviewFlags, "generation-unavailable"]);
    const qualityFlags = uniqueStrings([...variant.audio.qualityFlags, "generation-skipped"]);
    return {
      variant: {
        ...variant,
        audio: {
          ...variant.audio,
          reviewFlags,
          qualityFlags
        }
      },
      job: {
        entrySlug: entry.slug,
        variantId: variant.id,
        locale: variant.locale,
        kind: variant.audio.kind,
        status: "skipped",
        engineId: variant.audio.engine,
        inputKind: null,
        inputValue: null,
        sourcePath: variant.audio.src,
        outputPath: null,
        cacheKey: null,
        reviewFlags,
        qualityFlags
      }
    };
  }

  const cacheKey = hashJobInput([
    selected.engine.id,
    variant.locale,
    selected.input.kind,
    selected.input.value,
    JSON.stringify(variant.audio.engineInputs)
  ]);
  const output = buildGeneratedOutputPath(entry, variant, selected.engine, cacheKey);
  const status = await restoreOrGenerateAudio(selected.engine, variant, output, cacheKey, selected.input);
  const reviewFlags = uniqueStrings([
    ...variant.audio.reviewFlags,
    ...(status === "skipped" ? ["generation-unavailable"] : []),
    ...(status === "failed" ? ["generation-failed"] : [])
  ]);
  const qualityFlags = uniqueStrings([
    ...variant.audio.qualityFlags,
    ...(status === "generated" ? ["generated-audio"] : []),
    ...(status === "skipped" ? ["generation-skipped"] : []),
    ...(status === "failed" ? ["generation-failed"] : [])
  ]);

  return {
    variant: {
      ...variant,
      audio: {
        ...variant.audio,
        src: status === "generated" ? output.relative : variant.audio.src,
        mimeType: status === "generated" ? selected.engine.mimeType : variant.audio.mimeType,
        engine: selected.engine.id,
        engineInput: selected.input.value,
        cachePath: status === "generated" ? output.relative : variant.audio.cachePath,
        reviewFlags,
        qualityFlags
      }
    },
    job: {
      entrySlug: entry.slug,
      variantId: variant.id,
      locale: variant.locale,
      kind: variant.audio.kind,
      status,
      engineId: selected.engine.id,
      inputKind: selected.input.kind,
      inputValue: selected.input.value,
      sourcePath: variant.audio.src,
      outputPath: status === "generated" ? output.relative : null,
      cacheKey,
      reviewFlags,
      qualityFlags
    }
  };
}

export async function materializePreviewAudio(
  entries: Entry[],
  engines: AudioGenerationEngine[] = DEFAULT_ENGINES
): Promise<Entry[]> {
  const manifest: AudioManifest = {
    generatedAt: new Date().toISOString(),
    engineIds: engines.map((engine) => engine.id),
    jobCount: 0,
    jobs: []
  };
  const nextEntries: Entry[] = [];

  for (const entry of entries) {
    const variants: PronunciationVariant[] = [];

    for (const variant of entry.variants) {
      const result = await processVariantAudio(entry, variant, engines);
      variants.push(result.variant);
      manifest.jobs.push(result.job);
    }

    nextEntries.push({
      ...entry,
      variants
    });
  }

  manifest.jobCount = manifest.jobs.length;
  await writeJsonFile(AUDIO_MANIFEST_PATH, manifest);
  await writeJsonFile(path.join(DIST_PUBLIC_DIR, "audio", "manifest.json"), manifest);

  return nextEntries;
}
