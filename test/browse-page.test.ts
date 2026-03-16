import { buildSiteConfig } from "../src/lib/site-config";
import { renderBrowsePage } from "../src/templates/browse-page";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("browse page rendering", () => {
  test("renders the full corpus index with generated and curated entries", async () => {
    const corpus = await buildFixtureCorpus();
    const html = renderBrowsePage(corpus, buildSiteConfig());

    expect(html).toContain("Browse all 1000 pronunciation pages");
    expect(html).toContain("/w/qatar");
    expect(html).toContain("/w/alejandro");
    expect(html).toContain("/w/zephyrless");
  });
});
