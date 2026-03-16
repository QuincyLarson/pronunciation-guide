import { buildSitemapArtifacts } from "../src/lib/build/pipeline";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("sitemap generation", () => {
  test("emits sitemap index and excludes noindex entries", async () => {
    const corpus = await buildFixtureCorpus();
    const files = await buildSitemapArtifacts(corpus, "https://example.com");

    const index = files.get("sitemap.xml");
    const core = files.get("sitemaps/core.xml");
    const origin = files.get("sitemaps/origins-chinese.xml");
    const expanded = files.get("sitemaps/expanded-1.xml");
    const learn = files.get("sitemaps/learn-ipa.xml");

    expect(index).toContain("sitemaps/core.xml");
    expect(core).toContain("https://example.com/w/qatar");
    expect(origin).toContain("https://example.com/w/qigong");
    expect(expanded).toBeDefined();
    expect(learn).toContain("https://example.com/learn-ipa");
    expect(learn).toContain("https://example.com/learn-ipa/module/vowel-basics");
    expect(core).not.toContain("https://example.com/w/omeprazole");
  });
});
