import { buildAttributionGroups, buildLicenseManifest } from "../src/lib/build/pipeline";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("attribution manifests", () => {
  test("groups provenance fields and emits license summaries", async () => {
    const corpus = await buildFixtureCorpus();
    const groups = buildAttributionGroups(corpus);
    const manifest = buildLicenseManifest(corpus, groups);

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((group) => group.fields.length > 0)).toBe(true);
    expect(groups.some((group) => group.audioVariantCount > 0)).toBe(true);
    expect(manifest.licenses.some((license) => license.license === "CMUdict license")).toBe(true);
    expect(manifest.audioLicenses.length).toBeGreaterThan(0);
    expect(manifest.audioLicenses.some((license) => license.variantCount > 0)).toBe(true);
  });
});
