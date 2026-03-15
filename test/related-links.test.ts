import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("related-link generation", () => {
  test("builds useful related links from manual, origin, and topic signals", async () => {
    const corpus = await buildFixtureCorpus();
    const qatar = corpus.find((entry) => entry.slug === "qatar");

    expect(qatar).toBeDefined();
    expect(qatar?.related.length).toBeGreaterThanOrEqual(2);
    expect(qatar?.related.length).toBeLessThanOrEqual(6);
    expect(qatar?.related.map((link) => link.slug)).toEqual(
      expect.arrayContaining(["doha", "beijing"])
    );
  });
});
