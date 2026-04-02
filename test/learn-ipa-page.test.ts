import { describe, expect, test } from "vitest";

import { getLearnIpaAppPath } from "../src/lib/learn-ipa/routes";
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
    const progress = renderLearnIpaPage(curriculum, config, { progressView: true });

    expect(landing).toContain("/assets/client/learn-ipa/app.js");
    expect(landing).toContain("/learn-ipa/curriculum.json");
    expect(landing).toContain('/learn-ipa/drill-examples.json');
    expect(landing).toContain("<h1>Curriculum</h1>");
    expect(landing).toContain("/browse/");

    expect(reference).toContain("IPA Reference");
    expect(reference).toContain("/learn-ipa/?step=unit-02-s2");
    expect(reference).toContain("symbol-%C9%99");

    expect(progress).toContain('meta name="robots" content="noindex,follow"');
    expect(progress).toContain('data-initial-view="progress"');
  });
});

describe("learn IPA routes", () => {
  test("uses a dedicated progress path when rendering progress-only view URLs", () => {
    expect(getLearnIpaAppPath()).toBe("/learn-ipa/");
    expect(getLearnIpaAppPath({ view: "progress" })).toBe("/learn-ipa/progress/");
    expect(getLearnIpaAppPath({ view: "progress", stepId: "unit-01-s1" })).toBe(
      "/learn-ipa/?step=unit-01-s1&view=progress"
    );
  });
});
