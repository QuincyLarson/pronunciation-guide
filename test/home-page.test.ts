import { describe, expect, test } from "vitest";

import { buildLearnIpaCurriculum } from "../src/lib/build/learn-ipa";
import { buildSiteConfig } from "../src/lib/site-config";
import { renderHomePage } from "../src/templates/home-page";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("home page rendering", () => {
  test("renders a curriculum-first landing page with supporting word pages", async () => {
    const corpus = await buildFixtureCorpus();
    const curriculum = await buildLearnIpaCurriculum(corpus);
    const featured = corpus.filter((entry) => ["qatar", "alejandro", "tsunami"].includes(entry.slug));
    const html = renderHomePage(featured, corpus.length, curriculum, buildSiteConfig());

    expect(html).toContain("Master IPA through short lessons and real words.");
    expect(html).toContain("/learn-ipa/");
    expect(html).toContain("/browse/");
    expect(html).toContain("Work top to bottom like a learning track.");
    expect(html).toContain("/w/qatar");
  });
});
