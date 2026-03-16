import path from "node:path";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";

import {
  AUDIO_MANIFEST_PATH,
  AUDIO_CACHE_DIR,
  DIST_AUDIO_DIR,
  DIST_PUBLIC_DIR
} from "../src/lib/build/paths";
import {
  choosePreviewSpeechText,
  chooseSayVoice,
  isFixturePreviewAudio,
  materializePreviewAudio
} from "../src/lib/build/audio";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";
import { entrySchema, type AudioMetadata } from "../src/types/content";

const AUDIO_TEST_SLUG = "audio-pipeline-spec";

afterEach(async () => {
  await rm(path.join(DIST_AUDIO_DIR, "generated", AUDIO_TEST_SLUG), {
    recursive: true,
    force: true
  });
  await rm(path.join(AUDIO_CACHE_DIR, AUDIO_TEST_SLUG), {
    recursive: true,
    force: true
  });
  await rm(path.join(DIST_AUDIO_DIR, "manifest.json"), { force: true });
  await rm(AUDIO_MANIFEST_PATH, { force: true });
});

function buildTestAudio(overrides: Partial<AudioMetadata> = {}): AudioMetadata {
  return {
    kind: "synthetic",
    src: "/audio/fixtures/synthetic-sample.wav",
    mimeType: "audio/wav",
    engine: "fixture-phonemes",
    engineInput: null,
    engineInputs: {
      fixture_phonemes: "K AH0 T AA1 R"
    },
    sourceName: "Fixture",
    sourceUrl: null,
    license: "CC0-1.0",
    licenseStatus: "clear",
    reviewStatus: "auto-imported",
    confidence: 0.85,
    cachePath: null,
    reviewFlags: [],
    qualityFlags: [],
    ...overrides
  };
}

describe("audio generation helpers", () => {
  test("identifies placeholder fixture audio files", () => {
    expect(isFixturePreviewAudio("/audio/fixtures/human-sample.wav")).toBe(true);
    expect(isFixturePreviewAudio("/audio/fixtures/synthetic-sample.wav")).toBe(true);
    expect(isFixturePreviewAudio("/audio/generated/qatar/en-newsroom.wav")).toBe(false);
  });

  test("builds a spoken preview phrase from respelling data", async () => {
    const corpus = await buildFixtureCorpus();
    const qatar = corpus.find((entry) => entry.slug === "qatar");
    const newsroom = qatar?.variants.find((variant) => variant.id === "en-newsroom");

    if (!qatar || !newsroom) {
      throw new Error("Missing qatar newsroom fixture");
    }

    expect(choosePreviewSpeechText(qatar, newsroom)).toBe("kah tar");
  });

  test("maps common locales to a local speech voice", () => {
    expect(chooseSayVoice("en-US")).toBe("Samantha");
    expect(chooseSayVoice("en-GB")).toBe("Daniel");
    expect(chooseSayVoice("de")).toBe("Anna");
    expect(chooseSayVoice("zh")).toContain("Chinese");
  });

  test("materializes generated audio with a stable cache path and manifest", async () => {
    const entry = entrySchema.parse({
      id: `en:${AUDIO_TEST_SLUG}`,
      slug: AUDIO_TEST_SLUG,
      display: "Qatar",
      language: "en",
      pos: ["proper noun"],
      glosses: ["country in the Middle East"],
      shortGloss: "country in the Middle East",
      origin: {
        sourceLanguage: "ar",
        sourceLanguageName: "Arabic",
        etymologyLabel: "Arabic loanword"
      },
      topics: ["news-names"],
      variants: [
        {
          id: "fixture-phonemes",
          label: "Fixture phonemes",
          locale: "en-US",
          ipa: "/kəˈtɑɹ/",
          respelling: "kuh-TAR",
          notes: [],
          audio: buildTestAudio(),
          provenanceIds: ["fixture-audio"],
          sortOrder: 0,
          fieldProvenance: {}
        }
      ],
      related: [],
      relatedSeedSlugs: [],
      semanticLinkSlugs: [],
      confusions: [],
      confusionNotes: [],
      provenance: [
        {
          id: "fixture-audio",
          sourceName: "Fixture",
          sourceUrl: "https://example.com/fixture",
          sourceLicense: "CC0-1.0",
          sourceRevision: "test",
          attributionText: "Fixture audio test",
          confidence: 0.9,
          reviewStatus: "auto-imported",
          fields: ["variants.audio.engineInputs.fixture_phonemes"],
          notes: []
        }
      ],
      fieldProvenance: {},
      qualityScore: 75,
      indexStatus: {
        mode: "index",
        sitemapEligible: true,
        reasons: []
      },
      searchRank: 10,
      badges: ["auto-imported"],
      bodyHtml: "",
      licenseNotes: [],
      reviewers: []
    });

    let generationCount = 0;
    const engine = {
      id: "fixture-phonemes",
      mimeType: "audio/wav",
      canRun() {
        return true;
      },
      pickInput(_entry: typeof entry, variant: (typeof entry)["variants"][number]) {
        const phonemes = variant.audio.engineInputs.fixture_phonemes;
        return phonemes ? { kind: "phonemes", value: phonemes } : null;
      },
      async generate(outputPath: string) {
        generationCount += 1;
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, Buffer.alloc(6000, generationCount));
      }
    };

    const [firstRun] = await materializePreviewAudio([entry], [engine]);
    const firstVariant = firstRun.variants[0];
    const firstOutputPath = path.join(DIST_PUBLIC_DIR, firstVariant.audio.src.replace(/^\/+/, ""));

    expect(firstVariant.audio.src).toMatch(
      /^\/audio\/generated\/audio-pipeline-spec\/fixture-phonemes-fixture-phonemes-[a-f0-9]{12}\.wav$/
    );
    expect(firstVariant.audio.cachePath).toBe(firstVariant.audio.src);
    expect(firstVariant.audio.engineInput).toBe("K AH0 T AA1 R");
    expect(firstVariant.audio.qualityFlags).toContain("generated-audio");
    expect((await stat(firstOutputPath)).size).toBeGreaterThan(4096);

    const manifest = JSON.parse(await readFile(AUDIO_MANIFEST_PATH, "utf8")) as {
      jobCount: number;
      jobs: Array<{
        status: string;
        inputKind: string | null;
        outputPath: string | null;
      }>;
    };

    expect(manifest.jobCount).toBe(1);
    expect(manifest.jobs[0]).toMatchObject({
      status: "generated",
      inputKind: "phonemes",
      outputPath: firstVariant.audio.src
    });

    await rm(firstOutputPath, { force: true });

    const [secondRun] = await materializePreviewAudio([entry], [engine]);
    expect(generationCount).toBe(1);
    expect(secondRun.variants[0].audio.src).toBe(firstVariant.audio.src);
  });
});
