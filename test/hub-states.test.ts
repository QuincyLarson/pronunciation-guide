import { buildOriginHubStates, buildTopicHubStates } from "../src/lib/hubs";
import { entrySchema, type Entry } from "../src/types/content";

function buildHubEntry(
  slug: string,
  originSlug: string,
  topics: string[],
  sitemapEligible: boolean
): Entry {
  return entrySchema.parse({
    id: `en:${slug}`,
    slug,
    display: slug,
    language: "en",
    pos: ["noun"],
    glosses: ["fixture gloss"],
    shortGloss: "fixture gloss",
    origin: {
      sourceLanguage: originSlug,
      sourceLanguageName: originSlug.toUpperCase(),
      etymologyLabel: `${originSlug} source`
    },
    topics,
    variants: [
      {
        id: "en-us",
        label: "US",
        locale: "en-US",
        ipa: "/tɛst/",
        respelling: "test",
        notes: [],
        audio: {
          kind: "human",
          src: "/audio/real/test.wav",
          mimeType: "audio/wav",
          engine: null,
          engineInput: null,
          engineInputs: {},
          sourceName: "Fixture",
          sourceUrl: "https://example.com/audio",
          license: "CC0-1.0",
          licenseStatus: "clear",
          reviewStatus: "reviewed",
          confidence: 0.95,
          cachePath: null,
          reviewFlags: [],
          qualityFlags: []
        },
        provenanceIds: ["fixture"],
        sortOrder: 0,
        fieldProvenance: {}
      }
    ],
    related: [
      { slug: "alpha", label: "Alpha", reason: "manual", priority: 10 },
      { slug: "beta", label: "Beta", reason: "manual", priority: 9 }
    ],
    relatedSeedSlugs: [],
    semanticLinkSlugs: [],
    confusions: [],
    confusionNotes: [],
    provenance: [
      {
        id: "fixture",
        sourceName: "Fixture",
        sourceUrl: "https://example.com/source",
        sourceLicense: "CC0-1.0",
        sourceRevision: "test",
        attributionText: "Fixture attribution",
        confidence: 0.9,
        reviewStatus: "reviewed",
        fields: ["glosses", "variants"],
        notes: []
      }
    ],
    fieldProvenance: {},
    qualityScore: 80,
    indexStatus: {
      mode: sitemapEligible ? "index" : "noindex",
      sitemapEligible,
      stage: sitemapEligible ? "indexable" : "candidate",
      tier: sitemapEligible ? "expanded" : "candidate",
      usefulnessScore: sitemapEligible ? 80 : 40,
      reasons: sitemapEligible ? [] : ["needs more support"],
      signals: sitemapEligible ? ["fixture"] : []
    },
    searchRank: 5,
    badges: [],
    bodyHtml: "",
    licenseNotes: [],
    reviewers: []
  });
}

describe("hub state generation", () => {
  test("creates fallback origin and topic hubs and respects the indexable threshold", () => {
    const entries = [
      buildHubEntry("swahili-one", "swahili", ["field-linguistics"], true),
      buildHubEntry("swahili-two", "swahili", ["field-linguistics"], false),
      buildHubEntry("zulu-one", "zulu", ["field-linguistics"], true),
      buildHubEntry("zulu-two", "zulu", ["field-linguistics"], true)
    ];

    const origins = buildOriginHubStates(entries, 2);
    const topics = buildTopicHubStates(entries, 2);

    const swahili = origins.find((hub) => hub.slug === "swahili");
    const zulu = origins.find((hub) => hub.slug === "zulu");
    const fieldLinguistics = topics.find((hub) => hub.slug === "field-linguistics");

    expect(swahili).toMatchObject({
      title: "Swahili-Origin Words",
      totalEntries: 2,
      indexableEntries: 1,
      indexable: false
    });
    expect(zulu?.indexable).toBe(true);
    expect(fieldLinguistics).toMatchObject({
      title: "Field Linguistics Terms",
      indexableEntries: 3,
      indexable: true
    });
  });
});
