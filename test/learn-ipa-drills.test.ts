import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

import {
  LEARN_IPA_DRILL_SOURCE_FILES,
  buildLearnIpaDrillAssignments,
  buildLearnIpaDrillLexicon
} from "../src/lib/build/learn-ipa-drills";
import { buildLearnIpaCurriculum } from "../src/lib/build/learn-ipa";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

async function createSourceDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "learn-ipa-drills-"));

  await writeFile(
    path.join(directory, LEARN_IPA_DRILL_SOURCE_FILES.cmudict),
    [
      "MAP  M AE1 P",
      "SEND  S EH1 N D",
      "LIFT  L IH1 F T",
      "PUBLIC  P AH1 B L IH0 K",
      "VELVET  V EH1 L V AH0 T",
      "WONDER  W AH1 N D ER0",
      "RATHER  R AE1 DH ER0",
      "ADAM  AE1 D AH0 M"
    ].join("\n"),
    "utf8"
  );

  await writeFile(
    path.join(directory, LEARN_IPA_DRILL_SOURCE_FILES.ipaDictUs),
    [
      "map\t/mæp/",
      "send\t/sɛnd/",
      "lift\t/lɪft/",
      "public\t/ˈpʌblɪk/",
      "velvet\t/ˈvɛlvət/",
      "wonder\t/ˈwʌndɚ/",
      "rather\t/ˈɹæðɚ/",
      "Adam\t/ˈædəm/"
    ].join("\n"),
    "utf8"
  );

  await writeFile(
    path.join(directory, LEARN_IPA_DRILL_SOURCE_FILES.ipaDictGb),
    ["map\t/mæp/", "send\t/sɛnd/", "lift\t/lɪft/"].join("\n"),
    "utf8"
  );

  return directory;
}

describe("learn IPA drill lexicon", () => {
  test("builds a filtered high-confidence drill lexicon from synced sources", async () => {
    const sourceDirectory = await createSourceDirectory();

    try {
      const lexicon = await buildLearnIpaDrillLexicon(await buildFixtureCorpus(), {
        sourceDirectory,
        maxExamples: 12
      });
      const byId = new Map(lexicon.examples.map((example) => [example.id, example]));

      expect(lexicon.examples.length).toBeGreaterThanOrEqual(7);
      expect(byId.has("drill-adam")).toBe(false);
      expect(byId.get("drill-map")?.ipa["en-US"]).toBe("mæp");
      expect(byId.get("drill-public")?.ipa["en-US"]).toBe("pʌblɪk");
      expect(byId.get("drill-public")?.focusSymbols).toEqual(["ʌ", "ɪ"]);
      expect(byId.get("drill-map")?.meaningGloss).toBeTruthy();
    } finally {
      await rm(sourceDirectory, { recursive: true, force: true });
    }
  });

  test("assigns drill words only after their symbols have been introduced", async () => {
    const sourceDirectory = await createSourceDirectory();

    try {
      const lexicon = await buildLearnIpaDrillLexicon(await buildFixtureCorpus(), {
        sourceDirectory,
        maxExamples: 12
      });
      const assignments = buildLearnIpaDrillAssignments(lexicon.examples, { maxExamplesPerUnit: 12 });

      expect(assignments.get("unit-01")).toEqual(
        expect.arrayContaining(["drill-send", "drill-lift"])
      );
      expect(assignments.get("unit-01")).not.toContain("drill-public");
      expect(assignments.get("unit-02")).toEqual(
        expect.arrayContaining(["drill-public", "drill-velvet"])
      );
      expect(assignments.get("unit-05b")).toContain("drill-wonder");
      expect(assignments.get("unit-10")).toContain("drill-rather");
    } finally {
      await rm(sourceDirectory, { recursive: true, force: true });
    }
  });

  test("wires generated drill ids into bonus rounds without replacing curated starters", async () => {
    const sourceDirectory = await createSourceDirectory();

    try {
      const corpus = await buildFixtureCorpus();
      const lexicon = await buildLearnIpaDrillLexicon(corpus, {
        sourceDirectory,
        maxExamples: 12
      });
      const curriculum = await buildLearnIpaCurriculum(corpus, lexicon);
      const unit01Bonus = curriculum.steps.find((step) => step.id === "unit-01-s5");
      const unit10Bonus = curriculum.steps.find((step) => step.id === "unit-10-s5");

      expect(unit01Bonus?.type).toBe("bonus-round");
      expect(unit10Bonus?.type).toBe("bonus-round");

      if (unit01Bonus?.type === "bonus-round") {
        expect(unit01Bonus.exampleIds).toContain("ex-cat");
        expect(unit01Bonus.drillExampleIds).toEqual(
          expect.arrayContaining(["drill-send", "drill-lift"])
        );
      }

      if (unit10Bonus?.type === "bonus-round") {
        expect(unit10Bonus.exampleIds).toContain("ex-weather");
        expect(unit10Bonus.drillExampleIds).toContain("drill-rather");
      }
    } finally {
      await rm(sourceDirectory, { recursive: true, force: true });
    }
  });
});
