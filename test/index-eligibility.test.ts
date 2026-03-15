import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("index eligibility", () => {
  test("marks rich pages as sitemap eligible", async () => {
    const corpus = await buildFixtureCorpus();
    const qatar = corpus.find((entry) => entry.slug === "qatar");

    expect(qatar?.indexStatus.mode).toBe("index");
    expect(qatar?.indexStatus.sitemapEligible).toBe(true);
  });

  test("keeps low-confidence entries out of sitemaps", async () => {
    const corpus = await buildFixtureCorpus();
    const omeprazole = corpus.find((entry) => entry.slug === "omeprazole");

    expect(omeprazole?.indexStatus.mode).toBe("noindex");
    expect(omeprazole?.indexStatus.reasons.join(" ")).toContain("low-confidence audio");
  });
});
