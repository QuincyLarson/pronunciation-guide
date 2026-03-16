import { buildSitemapArtifacts } from "../src/lib/build/pipeline";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("sitemap generation", () => {
  test("emits sitemap index and excludes noindex entries", async () => {
    const corpus = await buildFixtureCorpus();
    const files = await buildSitemapArtifacts(corpus, "https://example.com");

    const index = files.get("sitemap.xml");
    const core = files.get("sitemaps/core.xml");
    const originHubs = files.get("sitemaps/hubs-origins.xml");
    const topicHubs = files.get("sitemaps/hubs-topics.xml");
    const expanded = files.get("sitemaps/words-expanded-1.xml");
    const learn = files.get("sitemaps/learn-ipa.xml");

    expect(index).toContain("sitemaps/core.xml");
    expect(index).toContain("sitemaps/hubs-origins.xml");
    expect(core).toContain("https://example.com/w/qatar");
    expect(core).not.toContain("https://example.com/w/omeprazole");
    expect(originHubs).toContain("https://example.com/origins/chinese/");
    expect(topicHubs).toContain("https://example.com/topics/news-names/");
    expect(expanded).toBeDefined();
    expect(learn).toContain("https://example.com/learn-ipa");
    expect(learn).toContain("https://example.com/learn-ipa/module/vowel-basics");
  });
});
