import { describe, expect, test } from "vitest";

import { buildLearnIpaCurriculum } from "../src/lib/build/learn-ipa";
import { tokenizeIpaSymbols } from "../src/lib/learn-ipa/tokenize";
import { learnCurriculumSchema } from "../src/types/learn-ipa";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("learn IPA curriculum", () => {
  test("builds a valid 150-step curriculum from file-based content", async () => {
    const curriculum = await buildLearnIpaCurriculum(await buildFixtureCorpus());
    const parsed = learnCurriculumSchema.parse(curriculum);
    const stepIds = new Set(parsed.steps.map((step) => step.id));
    const conceptIds = new Set(parsed.concepts.map((concept) => concept.id));
    const exampleIds = new Set(parsed.examples.map((example) => example.id));

    expect(parsed.modules).toHaveLength(11);
    expect(parsed.concepts).toHaveLength(15);
    expect(parsed.steps).toHaveLength(150);
    expect(parsed.reviewCards).toHaveLength(125);
    expect(parsed.symbolToStep["ə"]).toBe("unit-02-s2");
    expect(parsed.symbolToStep["ɚ"]).toBe("unit-05b-s1");
    expect(parsed.symbolToStep["ɝ"]).toBe("unit-05b-s2");
    expect(parsed.symbolToStep["ʃ"]).toBe("unit-08-s1");

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
  });

  test("tokenizes IPA using the longest known symbols first", () => {
    const tokens = tokenizeIpaSymbols("/ˈtʃoʊ.tleɪ/", ["tʃ", "t", "ʃ", "oʊ", "o", "ʊ", "eɪ"]);

    expect(tokens).toEqual(["ˈ", "tʃ", "oʊ", "t", "l", "eɪ"]);
  });
});
