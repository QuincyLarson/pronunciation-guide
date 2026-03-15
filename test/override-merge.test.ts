import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("override merge logic", () => {
  test("applies human overrides on top of generated entries", async () => {
    const corpus = await buildFixtureCorpus();
    const zeitgeist = corpus.find((entry) => entry.slug === "zeitgeist");

    expect(zeitgeist).toBeDefined();
    expect(zeitgeist?.badges).toContain("human-edited");
    expect(zeitgeist?.bodyHtml).toContain("English writing");

    const variant = zeitgeist?.variants.find((candidate) => candidate.id === "en-us-default");
    expect(variant?.audio.reviewStatus).toBe("human-edited");
    expect(variant?.audio.sourceName).toBe("Repository override fixture");
  });

  test("preserves native-reviewed metadata from overrides", async () => {
    const corpus = await buildFixtureCorpus();
    const nguyen = corpus.find((entry) => entry.slug === "nguyen");

    expect(nguyen?.badges).toContain("native-reviewed");
    expect(nguyen?.reviewers).toContain("native-speaker-fixture");
  });
});
