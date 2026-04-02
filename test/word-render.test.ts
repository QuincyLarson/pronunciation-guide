import { buildLearnIpaCurriculum } from "../src/lib/build/learn-ipa";
import { buildLearnIpaLookup, getLearnIpaLinks } from "../src/lib/learn-ipa/lookup";
import { entrySchema } from "../src/types/content";
import { renderWordPage } from "../src/templates/word-page";
import { buildSiteConfig } from "../src/lib/site-config";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("word page rendering", () => {
  test("renders variant cards, learn links, related links, and robots metadata", async () => {
    const corpus = await buildFixtureCorpus();
    const qatar = corpus.find((entry) => entry.slug === "qatar");
    if (!qatar) {
      throw new Error("Missing qatar fixture entry");
    }

    const curriculum = await buildLearnIpaCurriculum(corpus);
    const lookup = buildLearnIpaLookup(curriculum);
    const html = renderWordPage(qatar, buildSiteConfig(), getLearnIpaLinks(qatar, lookup));
    expect(html).toContain("<h1>Qatar</h1>");
    expect(html).toContain("Replay 0.5x");
    expect(html).toContain('meta name="robots" content="index,follow"');
    expect(html).toContain("/w/doha");
    expect(html).toContain("Pronunciation variants");
    expect(html).toContain("Study the symbols in this word");
    expect(html).toContain("/learn-ipa/?step=");
    expect(html).toContain('data-autoplay="true"');
    expect(html).toContain('preload="auto"');
    expect(html).toContain('data-speech-text=');
    expect(html).toContain('data-speech-locale=');
    expect(html).toContain("autoplay");
  });

  test("renders candidate pages with noindex robots and blocker text", async () => {
    const corpus = await buildFixtureCorpus();
    const omeprazole = corpus.find((entry) => entry.slug === "omeprazole");
    if (!omeprazole) {
      throw new Error("Missing omeprazole fixture entry");
    }

    const html = renderWordPage(omeprazole, buildSiteConfig(), []);
    expect(html).toContain('meta name="robots" content="noindex,follow"');
    expect(html).toContain("Current blockers:");
    expect(html).toContain("low-confidence audio");
  });

  test("maps r-colored vowels back to explicit learn-IPA lessons", async () => {
    const curriculum = await buildLearnIpaCurriculum(await buildFixtureCorpus());
    const lookup = buildLearnIpaLookup(curriculum);
    const entry = entrySchema.parse({
      id: "en:word",
      slug: "word",
      display: "word",
      language: "en",
      origin: {},
      variants: [
        {
          id: "ga",
          label: "General American",
          locale: "en-US",
          ipa: "/wɝd/",
          respelling: "wurd",
          audio: {
            kind: "synthetic",
            src: "/audio/test.wav",
            reviewStatus: "reviewed",
            confidence: 1
          }
        }
      ],
      indexStatus: {
        mode: "index",
        sitemapEligible: true
      }
    });

    expect(getLearnIpaLinks(entry, lookup)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "ɝ",
          stepId: "unit-05b-s2"
        })
      ])
    );
  });
});
