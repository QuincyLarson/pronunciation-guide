import { describe, expect, test } from "vitest";

import {
  applyReviewOutcome,
  createEmptyLearnIpaState,
  ensureLearnIpaState,
  getReviewCardsForStep,
  markStepCompleted
} from "../src/lib/learn-ipa/progress";
import { buildLearnIpaCurriculum } from "../src/lib/build/learn-ipa";
import { buildFixtureCorpus } from "./helpers/fixture-corpus";

describe("learn IPA progress", () => {
  test("initializes with the first module unlocked and the first step queued", async () => {
    const curriculum = await buildLearnIpaCurriculum(await buildFixtureCorpus());
    const state = ensureLearnIpaState(createEmptyLearnIpaState(), curriculum);

    expect(state.unlockedModuleIds).toContain(curriculum.modules[0]?.id);
    expect(state.currentStepId).toBe("unit-01-s1");
  });

  test("unlocking advances after a module is completed", async () => {
    const curriculum = await buildLearnIpaCurriculum(await buildFixtureCorpus());
    let state = ensureLearnIpaState(createEmptyLearnIpaState(), curriculum);
    const firstModule = curriculum.modules[0];
    const secondModule = curriculum.modules[1];

    for (const stepId of firstModule.stepIds) {
      state = markStepCompleted(curriculum, state, stepId, new Date("2026-03-15T12:00:00Z"));
    }

    expect(state.completedStepIds).toEqual(firstModule.stepIds);
    expect(state.unlockedModuleIds).toContain(secondModule?.id);
  });

  test("review outcomes create spaced future due dates and stable review batches", async () => {
    const curriculum = await buildLearnIpaCurriculum(await buildFixtureCorpus());
    const step = curriculum.steps.find((candidate) => candidate.type === "review-round");
    const now = new Date("2026-03-15T12:00:00Z");
    let state = ensureLearnIpaState(createEmptyLearnIpaState(), curriculum);

    expect(step?.type).toBe("review-round");
    const cards = step ? getReviewCardsForStep(curriculum, state, step, now) : [];
    expect(cards.length).toBeGreaterThan(0);

    if (!cards[0]) {
      throw new Error("Expected at least one review card.");
    }

    state = applyReviewOutcome(state, cards[0].id, "good", now);

    const scheduled = state.symbolStats[cards[0].id];
    expect(scheduled?.dueAt).not.toBeNull();
    expect(new Date(scheduled?.dueAt ?? now.toISOString()).getTime()).toBeGreaterThan(now.getTime());
    expect(scheduled?.confidence ?? 0).toBeGreaterThan(0);
  });
});
