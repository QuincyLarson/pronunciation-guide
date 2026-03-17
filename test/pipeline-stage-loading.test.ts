import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { describe, expect, test } from "vitest";

import { loadFirstAvailableCorpus } from "../src/lib/build/pipeline";

describe("pipeline stage loading", () => {
  test("falls back past unreadable stage files to the first valid corpus", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pipeline-stage-loading-"));
    const unreadablePath = path.join(tempRoot, "scored-corpus.json");
    const fallbackPath = path.join(tempRoot, "linked-corpus.json");

    await writeFile(unreadablePath, "", "utf8");
    await writeFile(
      fallbackPath,
      JSON.stringify([
        {
          id: "en:test-word",
          slug: "test-word",
          display: "test word",
          language: "en",
          origin: {},
          variants: [],
          indexStatus: {
            mode: "index",
            sitemapEligible: true
          }
        }
      ]),
      "utf8"
    );

    const corpus = await loadFirstAvailableCorpus([unreadablePath, fallbackPath]);

    expect(corpus).toHaveLength(1);
    expect(corpus[0]?.slug).toBe("test-word");
  });
});
