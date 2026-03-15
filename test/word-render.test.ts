import { renderWordPage } from "../src/templates/word-page";
import { buildSiteConfig } from "../src/lib/site-config";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("word page rendering", () => {
  test("renders variant cards, related links, and robots metadata", async () => {
    const corpus = await buildFixtureCorpus();
    const qatar = corpus.find((entry) => entry.slug === "qatar");
    if (!qatar) {
      throw new Error("Missing qatar fixture entry");
    }

    const html = renderWordPage(qatar, buildSiteConfig());
    expect(html).toContain("<h1>Qatar</h1>");
    expect(html).toContain("Replay 0.5x");
    expect(html).toContain('meta name="robots" content="index,follow"');
    expect(html).toContain("/w/doha");
    expect(html).toContain("Pronunciation variants");
  });
});
