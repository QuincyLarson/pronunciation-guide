import { buildGraduationManifest } from "../src/lib/build/graduation";
import { createIndexStatusRules, scoreEntries } from "../src/lib/index-status";
import { entrySchema, type Entry } from "../src/types/content";
import { graduationRulesSchema } from "../src/types/graduation";

function buildCandidateEntry(slug: string, overrides: Partial<Entry> = {}): Entry {
  return entrySchema.parse({
    id: `en:${slug}`,
    slug,
    display: slug,
    language: "en",
    pos: ["noun"],
    glosses: ["fixture gloss"],
    shortGloss: null,
    origin: {},
    topics: [],
    variants: [
      {
        id: "en-us",
        label: "US",
        locale: "en-US",
        ipa: "/tɛst/",
        respelling: "test",
        notes: [],
        audio: {
          kind: "synthetic",
          src: "/audio/fixtures/synthetic-sample.wav",
          mimeType: "audio/wav",
          engine: "fixture",
          engineInput: null,
          engineInputs: {},
          sourceName: "Fixture",
          sourceUrl: "https://example.com/audio",
          license: "CC0-1.0",
          licenseStatus: "clear",
          reviewStatus: "auto-imported",
          confidence: 0.9,
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
        reviewStatus: "auto-imported",
        fields: ["glosses", "variants"],
        notes: []
      }
    ],
    fieldProvenance: {},
    qualityScore: 0,
    indexStatus: {
      mode: "noindex",
      sitemapEligible: false,
      reasons: []
    },
    searchRank: 1,
    badges: [],
    bodyHtml:
      "<p>This fixture entry includes enough supporting editorial context to avoid the synthetic-only thin-content blocker.</p>",
    licenseNotes: [],
    reviewers: [],
    ...overrides
  });
}

describe("index graduation rules", () => {
  test("manual and Search Console promotion graduate otherwise thin candidates", () => {
    const rules = graduationRulesSchema.parse({
      manual: {
        promote: [
          {
            slug: "manual-promo",
            tier: "core",
            reason: "Editor promoted",
            source: "manual"
          }
        ]
      },
      searchConsole: {
        promote: [
          {
            slug: "search-promo",
            impressions: 100,
            clicks: 12,
            ctr: 0.12,
            position: 4.2,
            tier: "expanded",
            reason: "Strong demand signal"
          }
        ]
      }
    });

    const [plain, manual, searchConsole] = scoreEntries(
      [
        buildCandidateEntry("plain-candidate"),
        buildCandidateEntry("manual-promo"),
        buildCandidateEntry("search-promo")
      ],
      createIndexStatusRules(rules)
    );

    expect(plain.indexStatus.mode).toBe("noindex");
    expect(plain.indexStatus.reasons.join(" ")).toContain("usefulness score");

    expect(manual.indexStatus.mode).toBe("index");
    expect(manual.indexStatus.tier).toBe("core");
    expect(manual.indexStatus.signals.join(" ")).toContain("manual-promotion");

    expect(searchConsole.indexStatus.mode).toBe("index");
    expect(searchConsole.indexStatus.tier).toBe("expanded");
    expect(searchConsole.indexStatus.signals.join(" ")).toContain("search-console-promotion");
  });

  test("suppression keeps otherwise qualified pages out of sitemaps and shows up in the manifest", () => {
    const rules = graduationRulesSchema.parse({
      manual: {
        suppress: [
          {
            slug: "blocked-page",
            reason: "Hold for editorial review",
            source: "manual"
          }
        ]
      }
    });

    const scored = scoreEntries(
      [
        buildCandidateEntry("blocked-page", {
          shortGloss: "fixture gloss",
          origin: {
            sourceLanguage: "de",
            sourceLanguageName: "German",
            etymologyLabel: "German borrowing"
          },
          variants: [
            {
              ...buildCandidateEntry("blocked-page").variants[0],
              audio: {
                ...buildCandidateEntry("blocked-page").variants[0].audio,
                kind: "human"
              }
            }
          ]
        })
      ],
      createIndexStatusRules(rules)
    );
    const manifest = buildGraduationManifest(scored, rules);

    expect(scored[0].indexStatus.mode).toBe("noindex");
    expect(scored[0].indexStatus.reasons.join(" ")).toContain("suppression");
    expect(manifest.counts.candidate).toBe(1);
    expect(manifest.suppressions[0]?.slug).toBe("blocked-page");
    expect(manifest.candidates[0]?.slug).toBe("blocked-page");
  });
});
