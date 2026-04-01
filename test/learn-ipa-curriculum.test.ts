import { describe, expect, test } from "vitest";

import { buildLearnIpaCurriculum } from "../src/lib/build/learn-ipa";
import { tokenizeIpaSymbols } from "../src/lib/learn-ipa/tokenize";
import { learnCurriculumSchema } from "../src/types/learn-ipa";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("learn IPA curriculum", () => {
  test("builds a valid expanded curriculum from file-based content", async () => {
    const curriculum = await buildLearnIpaCurriculum(await buildFixtureCorpus());
    const parsed = learnCurriculumSchema.parse(curriculum);
    const stepIds = new Set(parsed.steps.map((step) => step.id));
    const conceptIds = new Set(parsed.concepts.map((concept) => concept.id));
    const exampleIds = new Set(parsed.examples.map((example) => example.id));

    expect(parsed.modules).toHaveLength(11);
    expect(parsed.concepts).toHaveLength(16);
    expect(parsed.steps).toHaveLength(156);
    expect(parsed.reviewCards).toHaveLength(130);
    expect(parsed.examples.length).toBeGreaterThan(180);
    expect(parsed.symbolToStep["ə"]).toBe("unit-02-s2");
    expect(parsed.symbolToStep["ɚ"]).toBe("unit-05b-s1");
    expect(parsed.symbolToStep["ɝ"]).toBe("unit-05b-s2");
    expect(parsed.symbolToStep["ʃ"]).toBe("unit-08-s1");
    expect(parsed.symbolToStep["ɛ̃"]).toBe("unit-16b-s1");
    expect(parsed.symbolToStep["ɔ̃"]).toBe("unit-16b-s2");

    for (const module of parsed.modules) {
      expect(module.stepIds.length).toBeGreaterThan(0);
      expect(module.unitIds.length).toBeGreaterThan(0);
    }

    for (const step of parsed.steps) {
      if (step.type === "teach-concept") {
        expect(conceptIds.has(step.conceptId)).toBe(true);
      }

      if ("exampleIds" in step) {
        for (const exampleId of step.exampleIds) {
          expect(exampleIds.has(exampleId)).toBe(true);
        }
      }

      if (step.type === "listen-match") {
        expect(exampleIds.has(step.promptExampleId)).toBe(true);
        for (const exampleId of step.choiceExampleIds) {
          expect(exampleIds.has(exampleId)).toBe(true);
        }
      }

      if (step.type === "review-round") {
        for (const reviewCardId of step.reviewCardIds) {
          expect(parsed.reviewCards.some((card) => card.id === reviewCardId)).toBe(true);
        }
      }
    }

    for (const card of parsed.reviewCards) {
      expect(card.relatedStepId ? stepIds.has(card.relatedStepId) : true).toBe(true);
    }

    expect(
      parsed.reviewCards.find((card) => card.id === "card:unit-01:symbol:æ")?.relatedStepId
    ).toBe("unit-01-s1");
    expect(
      parsed.reviewCards.find((card) => card.id === "card:unit-01:symbol:ɛ")?.relatedStepId
    ).toBe("unit-01-s2");
    expect(
      parsed.reviewCards.find((card) => card.id === "card:unit-01:symbol:ɪ")?.relatedStepId
    ).toBe("unit-01-s3");

    expect(parsed.relatedWordLinks["ə"]?.length ?? 0).toBeGreaterThan(0);
    expect(parsed.relatedWordLinks["ʃ"]?.length ?? 0).toBeGreaterThan(0);

    const unit01Bonus = parsed.steps.find((step) => step.id === "unit-01-s5");
    const unit10Bonus = parsed.steps.find((step) => step.id === "unit-10-s5");
    const unit16bBonus = parsed.steps.find((step) => step.id === "unit-16b-s5");
    const unit21Bonus = parsed.steps.find((step) => step.id === "unit-21-s5");

    expect(unit01Bonus?.type).toBe("bonus-round");
    expect(unit10Bonus?.type).toBe("bonus-round");
    expect(unit16bBonus?.type).toBe("bonus-round");
    expect(unit21Bonus?.type).toBe("bonus-round");

    if (unit01Bonus?.type === "bonus-round") {
      expect(unit01Bonus.exampleIds.length).toBeGreaterThanOrEqual(10);
      expect(unit01Bonus.exampleIds).toContain("ex-bag");
      expect(unit01Bonus.exampleIds).toContain("ex-milk");
    }

    if (unit10Bonus?.type === "bonus-round") {
      expect(unit10Bonus.exampleIds.length).toBeGreaterThanOrEqual(12);
      expect(unit10Bonus.exampleIds).toContain("ex-three");
      expect(unit10Bonus.exampleIds).toContain("ex-weather");
    }

    if (unit16bBonus?.type === "bonus-round") {
      expect(unit16bBonus.exampleIds).toContain("ex-matin");
      expect(unit16bBonus.exampleIds).toContain("ex-nom");
    }

    if (unit21Bonus?.type === "bonus-round") {
      expect(unit21Bonus.exampleIds).toContain("ex-tone-high");
      expect(unit21Bonus.exampleIds).toContain("ex-tone-low");
    }
  });

  test("tokenizes IPA using the longest known symbols first", () => {
    const tokens = tokenizeIpaSymbols("/ˈtʃoʊ.tleɪ/", ["tʃ", "t", "ʃ", "oʊ", "o", "ʊ", "eɪ"]);

    expect(tokens).toEqual(["ˈ", "tʃ", "oʊ", "t", "l", "eɪ"]);
  });
});
