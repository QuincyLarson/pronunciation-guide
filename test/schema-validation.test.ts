import { entrySchema } from "../src/types/content";
import { importSources, importedSourcesSchema, loadOverrides } from "../src/lib/build/sources";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("schema validation", () => {
  test("fixture snapshots validate and exceed the minimum corpus size", async () => {
    const imported = await importSources();
    const parsed = importedSourcesSchema.parse(imported);

    expect(parsed.wiktionary.length).toBeGreaterThanOrEqual(20);
    expect(parsed.cmudict.length).toBeGreaterThan(0);
    expect(parsed.wordnet.length).toBeGreaterThan(0);
  });

  test("merged fixture corpus validates entry schema", async () => {
    const corpus = await buildFixtureCorpus();

    expect(corpus.length).toBeGreaterThanOrEqual(20);
    for (const entry of corpus) {
      expect(() => entrySchema.parse(entry)).not.toThrow();
    }
  });

  test("override frontmatter parses from markdown fixtures", async () => {
    const overrides = await loadOverrides();
    const qigong = overrides.find((override) => override.frontmatter.slug === "qigong");

    expect(overrides.length).toBeGreaterThanOrEqual(5);
    expect(qigong?.frontmatter.badges).toContain("native-reviewed");
    expect(qigong?.bodyHtml).toContain("<p>");
  });
});
