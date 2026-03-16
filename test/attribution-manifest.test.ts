import { buildAttributionGroups, buildLicenseManifest } from "../src/lib/build/pipeline";
import { entrySchema } from "../src/types/content";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("attribution manifests", () => {
  test("groups provenance fields and emits license summaries", async () => {
    const corpus = await buildFixtureCorpus();
    const groups = buildAttributionGroups(corpus);
    const manifest = buildLicenseManifest(corpus, groups);

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((group) => group.fields.length > 0)).toBe(true);
    expect(groups.some((group) => group.audioVariantCount > 0)).toBe(true);
    expect(manifest.licenses.some((license) => license.license === "CMUdict license")).toBe(true);
    expect(manifest.audioLicenses.length).toBeGreaterThan(0);
    expect(manifest.audioLicenses.some((license) => license.variantCount > 0)).toBe(true);
  });

  test("does not double count one entry when multiple provenance rows share the same source", () => {
    const entry = entrySchema.parse({
      id: "en:fixture-entry",
      slug: "fixture-entry",
      display: "Fixture Entry",
      language: "en",
      pos: ["noun"],
      glosses: ["fixture gloss"],
      shortGloss: "fixture gloss",
      origin: {},
      topics: [],
      variants: [
        {
          id: "variant-a",
          label: "Variant A",
          locale: "en-US",
          ipa: "/fiːkstʃər/",
          respelling: "feekst-cher",
          notes: [],
          audio: {
            kind: "human",
            src: "/audio/real/fixture-entry.wav",
            mimeType: "audio/wav",
            engine: null,
            engineInput: null,
            engineInputs: {},
            sourceName: "Fixture Source",
            sourceUrl: "https://example.com/audio",
            license: "CC BY 4.0",
            licenseStatus: "clear",
            reviewStatus: "reviewed",
            confidence: 0.95,
            cachePath: null,
            reviewFlags: [],
            qualityFlags: []
          },
          provenanceIds: ["fixture-source-a"],
          sortOrder: 0,
          fieldProvenance: {}
        },
        {
          id: "variant-b",
          label: "Variant B",
          locale: "en-GB",
          ipa: "/fiːkstʃə/",
          respelling: "feekst-cha",
          notes: [],
          audio: {
            kind: "synthetic",
            src: "/audio/fixtures/synthetic-sample.wav",
            mimeType: "audio/wav",
            engine: "fixture",
            engineInput: null,
            engineInputs: {},
            sourceName: "Fixture Source",
            sourceUrl: "https://example.com/audio",
            license: "CC BY 4.0",
            licenseStatus: "review-needed",
            reviewStatus: "auto-imported",
            confidence: 0.8,
            cachePath: null,
            reviewFlags: [],
            qualityFlags: []
          },
          provenanceIds: ["fixture-source-b"],
          sortOrder: 1,
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
          id: "fixture-source-a",
          sourceName: "Fixture Source",
          sourceUrl: "https://example.com/source",
          sourceLicense: "CC BY 4.0",
          sourceRevision: "a",
          attributionText: "Fixture source attribution",
          confidence: 0.9,
          reviewStatus: "reviewed",
          fields: ["glosses"],
          notes: []
        },
        {
          id: "fixture-source-b",
          sourceName: "Fixture Source",
          sourceUrl: "https://example.com/source",
          sourceLicense: "CC BY 4.0",
          sourceRevision: "b",
          attributionText: "Fixture source attribution",
          confidence: 0.9,
          reviewStatus: "reviewed",
          fields: ["variants"],
          notes: []
        }
      ],
      fieldProvenance: {},
      qualityScore: 80,
      indexStatus: {
        mode: "index",
        sitemapEligible: true,
        reasons: []
      },
      searchRank: 5,
      badges: [],
      bodyHtml: "",
      licenseNotes: [],
      reviewers: []
    });

    const groups = buildAttributionGroups([entry]);
    const manifest = buildLicenseManifest([entry], groups);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      entryCount: 1,
      audioVariantCount: 2
    });
    expect(groups[0].fields).toEqual(["glosses", "variants"]);
    expect(manifest.licenses[0]).toMatchObject({
      license: "CC BY 4.0",
      entryCount: 1
    });
    expect(manifest.audioLicenses[0]?.statusCounts).toMatchObject({
      clear: 1,
      "review-needed": 1,
      blocked: 0
    });
  });
});
