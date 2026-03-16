import { describe, expect, test } from "vitest";

import { buildLearnIpaCurriculum } from "../src/lib/build/learn-ipa";
import { buildSiteConfig } from "../src/lib/site-config";
import { renderLearnIpaPage } from "../src/templates/learn-ipa-page";
import { renderLearnIpaReferencePage } from "../src/templates/learn-ipa-reference-page";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("learn IPA page rendering", () => {
  test("renders the landing shell and reference catalog", async () => {
    const curriculum = await buildLearnIpaCurriculum(await buildFixtureCorpus());
    const config = buildSiteConfig();
    const landing = renderLearnIpaPage(curriculum, config);
    const reference = renderLearnIpaReferencePage(curriculum, config);

    expect(landing).toContain("/assets/client/learn-ipa/app.js");
    expect(landing).toContain("/learn-ipa/curriculum.json");
    expect(landing).toContain("Learn to read the IPA that actually appears on pronunciation pages.");
    expect(landing).toContain("/learn-ipa/module/vowel-basics/");

    expect(reference).toContain("IPA Reference");
    expect(reference).toContain("/learn-ipa/?step=unit-02-s2");
    expect(reference).toContain("symbol-%C9%99");
  });
});
