import { LEARN_IPA_STORAGE_KEY, migrateLearnIpaState } from "../../lib/learn-ipa/progress.js";

const state = (() => {
  try {
    const raw = window.localStorage.getItem(LEARN_IPA_STORAGE_KEY);
    return migrateLearnIpaState(raw ? JSON.parse(raw) : null);
  } catch {
    return migrateLearnIpaState(null);
  }
})();

for (const section of document.querySelectorAll<HTMLElement>("[data-learn-links]")) {
  const progressNode = section.querySelector<HTMLElement>("[data-learn-progress]");
  const pills = [...section.querySelectorAll<HTMLElement>("[data-learn-step-id]")];

  if (!progressNode || pills.length === 0) {
    continue;
  }

  let known = 0;

  for (const pill of pills) {
    const stepId = pill.dataset.learnStepId;
    if (!stepId) {
      continue;
    }

    if (state.completedStepIds.includes(stepId)) {
      known += 1;
      pill.classList.add("is-complete");
    }
  }

  progressNode.textContent =
    known > 0
      ? `You know ${known}/${pills.length} symbols in this word. Fill the remaining gaps in the course.`
      : `This word uses ${pills.length} symbols you can learn directly in the IPA course.`;
}
