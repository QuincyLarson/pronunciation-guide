import { entrySchema } from "../src/types/content";
import { importSources, importedSourcesSchema, loadOverrides } from "../src/lib/build/sources";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("schema validation", () => {
  test("fixture snapshots validate and reach the 1000-entry target corpus", async () => {
    const imported = await importSources();
    const parsed = importedSourcesSchema.parse(imported);

    expect(parsed.wiktionary.length).toBe(1000);
    expect(parsed.kaikki.length).toBeGreaterThan(0);
    expect(parsed.cmudict.length).toBeGreaterThan(0);
    expect(parsed.wordnet.length).toBeGreaterThan(0);
    expect(parsed.oewn.length).toBeGreaterThan(0);
    expect(parsed.ipaDict.length).toBeGreaterThan(0);
  });

  test("merged fixture corpus validates entry schema", async () => {
    const corpus = await buildFixtureCorpus();

    expect(corpus.length).toBe(1000);
    for (const entry of corpus) {
      expect(() => entrySchema.parse(entry)).not.toThrow();
    }

    const qatar = corpus.find((entry) => entry.slug === "qatar");
    expect(qatar?.fieldProvenance.display?.length ?? 0).toBeGreaterThan(0);
    expect(qatar?.variants.some((variant) => Object.keys(variant.fieldProvenance).length > 0)).toBe(true);
  });

  test("override frontmatter parses from markdown fixtures", async () => {
    const overrides = await loadOverrides();
    const qigong = overrides.find((override) => override.frontmatter.slug === "qigong");

    expect(overrides.length).toBeGreaterThanOrEqual(5);
    expect(qigong?.frontmatter.badges).toContain("native-reviewed");
    expect(qigong?.bodyHtml).toContain("<p>");
  });
});
