import {
  LEARN_IPA_STORAGE_KEY,
  applyReviewOutcome,
  ensureLearnIpaState,
  getDueReviewCardIds,
  getFirstStepIdForModule,
  getModuleProgress,
  getNextStepId,
  parseStoredLearnIpaState,
  getReviewCardsForStep,
  introduceReviewCards,
  markStepCompleted,
  migrateLearnIpaState,
  recordStepAttempt
} from "../../lib/learn-ipa/progress.js";
import { LEARN_IPA_ROOT_PATH, getLearnIpaAppPath, getLearnIpaModulePath } from "../../lib/learn-ipa/routes.js";
import type {
  LearnCurriculum,
  LearnIpaDrillLexicon,
  LearnStep,
  LessonExample,
  ReviewCard,
  ReviewOutcome
} from "../../types/learn-ipa";

type ViewMode = "overview" | "progress";

interface RouteState {
  stepId: string | null;
  moduleId: string | null;
  view: ViewMode;
}

interface StepSession {
  stepId: string | null;
  interacted: boolean;
  revealedExampleIds: string[];
  listenSelection: string | null;
  drillIndex: number;
  reviewIndex: number;
  reviewReveal: boolean;
  recordingState: "idle" | "recording";
  recordingUrl: string | null;
  recordingError: string | null;
}

const audioPlayer = new Audio();

let curriculum: LearnCurriculum | null = null;
let drillLexicon: LearnIpaDrillLexicon | null = null;
let progressState = migrateLearnIpaState(null);
let route: RouteState = readRoute();
let root: HTMLElement | null = null;
let session: StepSession = createStepSession(null);
let hasGesture = false;
let lastAutoplayStepId: string | null = null;
let speechUtterance: SpeechSynthesisUtterance | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let recordingChunks: BlobPart[] = [];
let drillLexiconPromise: Promise<void> | null = null;
let drillLexiconError: string | null = null;
let drillExampleMap = new Map<string, LessonExample>();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createStepSession(stepId: string | null): StepSession {
  return {
    stepId,
    interacted: false,
    revealedExampleIds: [],
    listenSelection: null,
    drillIndex: 0,
    reviewIndex: 0,
    reviewReveal: false,
    recordingState: "idle",
    recordingUrl: null,
    recordingError: null
  };
}

function readRoute(): RouteState {
  const url = new URL(window.location.href);
  const pathView = url.pathname === "/learn-ipa/progress/" ? "progress" : "overview";

  return {
    stepId: url.searchParams.get("step"),
    moduleId: url.searchParams.get("module"),
    view: url.searchParams.get("view") === "progress" ? "progress" : pathView
  };
}

function updateRoute(next: RouteState, replace = false): void {
  route = next;
  const url = getLearnIpaAppPath({
    stepId: next.stepId,
    moduleId: next.moduleId,
    view: next.view
  });

  if (replace) {
    window.history.replaceState(null, "", url);
  } else {
    window.history.pushState(null, "", url);
  }

  render();
}

function saveProgress(): void {
  window.localStorage.setItem(LEARN_IPA_STORAGE_KEY, JSON.stringify(progressState));
}

function loadProgress(): void {
  progressState = parseStoredLearnIpaState(window.localStorage.getItem(LEARN_IPA_STORAGE_KEY));
  if (curriculum) {
    progressState = ensureLearnIpaState(progressState, curriculum);
  }
}

function getMaps(current: LearnCurriculum) {
  return {
    examples: new Map(current.examples.map((example) => [example.id, example])),
    drillExamples: drillExampleMap,
    steps: new Map(current.steps.map((step) => [step.id, step])),
    modules: new Map(current.modules.map((module) => [module.id, module])),
    concepts: new Map(current.concepts.map((concept) => [concept.id, concept])),
    symbols: new Map(current.symbols.map((symbol) => [symbol.id, symbol])),
    reviewCards: new Map(current.reviewCards.map((card) => [card.id, card]))
  };
}

function getDrillLexiconSrc(): string {
  return root?.dataset.drillSrc ?? "/learn-ipa/drill-examples.json";
}

async function ensureDrillLexicon(): Promise<void> {
  if (drillLexicon || drillLexiconPromise) {
    return drillLexiconPromise ?? Promise.resolve();
  }

  drillLexiconError = null;
  drillLexiconPromise = fetch(getDrillLexiconSrc())
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as Partial<LearnIpaDrillLexicon>;
      const examples = Array.isArray(payload.examples) ? payload.examples : [];
      drillLexicon = {
        generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : new Date().toISOString(),
        version: typeof payload.version === "number" ? payload.version : 1,
        examples
      };
      drillExampleMap = new Map(examples.map((example) => [example.id, example]));
      drillLexiconError = null;
    })
    .catch((error) => {
      drillLexiconError =
        error instanceof Error ? error.message : "The expanded drill set could not be loaded right now.";
    })
    .finally(() => {
      drillLexiconPromise = null;
      render();
    });

  return drillLexiconPromise;
}

function getExampleFromMaps(
  maps: ReturnType<typeof getMaps>,
  exampleId: string
): LessonExample | null {
  return maps.examples.get(exampleId) ?? maps.drillExamples.get(exampleId) ?? null;
}

function getExampleById(current: LearnCurriculum, exampleId: string): LessonExample | null {
  return getExampleFromMaps(getMaps(current), exampleId);
}

function getExamplesById(current: LearnCurriculum, exampleIds: string[]): LessonExample[] {
  const maps = getMaps(current);
  return exampleIds
    .map((exampleId) => getExampleFromMaps(maps, exampleId))
    .filter((example): example is LessonExample => !!example);
}

function getBonusRoundExamples(current: LearnCurriculum, step: Extract<LearnStep, { type: "bonus-round" }>): LessonExample[] {
  if (step.drillExampleIds.length > 0 && !drillLexicon && !drillLexiconPromise) {
    void ensureDrillLexicon();
  }

  const drillExamples = step.drillExampleIds.length > 0 ? getExamplesById(current, step.drillExampleIds) : [];
  return drillExamples.length > 0 ? drillExamples : getExamplesById(current, step.exampleIds);
}

function getActiveStep(): LearnStep | null {
  if (!curriculum || !route.stepId) {
    return null;
  }

  return curriculum.steps.find((step) => step.id === route.stepId) ?? null;
}

function revokeRecordingUrl(url: string | null): void {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

function stopRecordingStream(): void {
  for (const track of recordingStream?.getTracks() ?? []) {
    track.stop();
  }

  recordingStream = null;
}

function discardMicPractice(): void {
  revokeRecordingUrl(session.recordingUrl);
  session.recordingUrl = null;
  session.recordingError = null;
  session.recordingState = "idle";
  recordingChunks = [];

  if (mediaRecorder) {
    mediaRecorder.ondataavailable = null;
    mediaRecorder.onstop = null;
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    mediaRecorder = null;
  }

  stopRecordingStream();
}

function ensureSession(stepId: string | null): void {
  if (session.stepId !== stepId) {
    discardMicPractice();
    session = createStepSession(stepId);
  }
}

function getExampleIpa(example: LessonExample, accent: "en-US" | "en-GB"): string {
  return example.ipa[accent] ?? Object.values(example.ipa)[0] ?? "";
}

function getExampleAudio(example: LessonExample, accent: "en-US" | "en-GB") {
  return (
    example.audio[accent] ??
    example.audio[accent === "en-US" ? "en-GB" : "en-US"] ??
    Object.values(example.audio)[0] ??
    null
  );
}

async function playExample(example: LessonExample, rate = progressState.settings.playbackRateDefault): Promise<void> {
  const accent = progressState.settings.accent;
  const audio = getExampleAudio(example, accent);

  try {
    if (audio?.src) {
      audioPlayer.src = audio.src;
      audioPlayer.playbackRate = rate;
      await audioPlayer.play();
      return;
    }
  } catch {
    // Fall back to browser speech when static audio is unavailable or blocked.
  }

  if (!audio?.speechText || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  speechUtterance = new SpeechSynthesisUtterance(audio.speechText);
  speechUtterance.lang = audio.accent || accent;
  speechUtterance.rate = rate === 0.5 ? 0.8 : 1;
  window.speechSynthesis.speak(speechUtterance);
}

function canUseMicPractice(): boolean {
  return (
    "MediaRecorder" in window &&
    "mediaDevices" in navigator &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

async function startMicPractice(): Promise<void> {
  if (!canUseMicPractice()) {
    session.recordingError = "Mic recording is not available in this browser.";
    render();
    return;
  }

  discardMicPractice();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const activeStepId = session.stepId;

    recordingStream = stream;
    mediaRecorder = recorder;
    recordingChunks = [];
    session.recordingState = "recording";
    session.recordingError = null;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const clip =
        recordingChunks.length > 0
          ? URL.createObjectURL(new Blob(recordingChunks, { type: recorder.mimeType || "audio/webm" }))
          : null;

      recordingChunks = [];
      mediaRecorder = null;
      stopRecordingStream();

      if (session.stepId !== activeStepId) {
        revokeRecordingUrl(clip);
        return;
      }

      session.recordingState = "idle";
      if (clip) {
        revokeRecordingUrl(session.recordingUrl);
        session.recordingUrl = clip;
        session.recordingError = null;
      } else {
        session.recordingError = "No audio was captured. Try again.";
      }

      render();
    };

    recorder.start();
    render();
  } catch (error) {
    mediaRecorder = null;
    stopRecordingStream();
    session.recordingState = "idle";
    session.recordingError =
      error instanceof DOMException && error.name === "NotAllowedError"
        ? "Mic permission was denied."
        : "Mic capture is unavailable right now.";
    render();
  }
}

function stopMicPractice(): void {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    return;
  }

  mediaRecorder.stop();
}

function markInteracted(): void {
  hasGesture = true;
  session.interacted = true;
}

function progressSummary(): { completed: number; total: number; ratio: number } {
  if (!curriculum) {
    return { completed: 0, total: 0, ratio: 0 };
  }

  const total = curriculum.steps.length;
  const completed = progressState.completedStepIds.length;
  return {
    completed,
    total,
    ratio: total > 0 ? completed / total : 0
  };
}

function renderProgressBar(ratio: number): string {
  return `<div class="learn-progress-bar" aria-hidden="true"><span style="width:${Math.round(ratio * 100)}%"></span></div>`;
}

function renderSettings(): string {
  return `<details class="learn-settings">
    <summary>Learning settings</summary>
    <div class="learn-settings-grid">
      <label>
        Accent
        <select data-action="set-accent">
          <option value="en-US" ${progressState.settings.accent === "en-US" ? "selected" : ""}>General American</option>
          <option value="en-GB" ${progressState.settings.accent === "en-GB" ? "selected" : ""}>British English</option>
        </select>
      </label>
      <label>
        Default replay speed
        <select data-action="set-rate">
          <option value="1" ${progressState.settings.playbackRateDefault === 1 ? "selected" : ""}>1x</option>
          <option value="0.5" ${progressState.settings.playbackRateDefault === 0.5 ? "selected" : ""}>0.5x</option>
        </select>
      </label>
      <label class="learn-checkbox">
        <input type="checkbox" data-action="toggle-autoplay" ${progressState.settings.autoplayAfterGesture ? "checked" : ""}>
        Autoplay the first example after I interact
      </label>
      <label class="learn-checkbox">
        <input type="checkbox" data-action="toggle-motion" ${progressState.settings.reducedMotion ? "checked" : ""}>
        Reduce celebratory motion
      </label>
      <label>
        Mic practice
        <select data-action="set-mic-mode">
          <option value="off" ${progressState.settings.micMode === "off" ? "selected" : ""}>Off</option>
          <option value="record-only" ${
            progressState.settings.micMode !== "off" ? "selected" : ""
          }>Record only</option>
        </select>
      </label>
    </div>
  </details>`;
}

function renderModuleCards(current: LearnCurriculum): string {
  return `<div class="learn-module-grid">
    ${current.modules
      .map((module) => {
        const summary = getModuleProgress(current, progressState, module.id);
        const unlocked =
          progressState.unlockedModuleIds.includes(module.id) ||
          summary.completed > 0 ||
          progressState.completedStepIds.length === current.steps.length;
        const startStepId = getFirstStepIdForModule(current, module.id);

        return `<article class="learn-module-card">
          <p class="eyebrow">Module</p>
          <h3><a href="${escapeHtml(getLearnIpaModulePath(module.slug))}">${escapeHtml(module.title)}</a></h3>
          <p>${escapeHtml(module.summary)}</p>
          ${renderProgressBar(summary.ratio)}
          <div class="meta-row">
            <span>${summary.completed}/${summary.total} steps</span>
            <span>${module.symbolIds.length} symbols</span>
            <span>${unlocked ? "Unlocked" : "Locked"}</span>
          </div>
          <div class="hero-actions">
            ${
              unlocked && startStepId
                ? `<button type="button" class="button-link" data-action="open-module" data-module-id="${escapeHtml(module.id)}" data-step-id="${escapeHtml(startStepId)}">${
                    summary.completed > 0 ? "Resume module" : "Start module"
                  }</button>`
                : `<button type="button" class="button-link subtle" disabled>Unlock by progressing</button>`
            }
            <a class="button-link subtle" href="${escapeHtml(getLearnIpaModulePath(module.slug))}">Overview</a>
          </div>
        </article>`;
      })
      .join("")}
  </div>`;
}

function renderOverview(current: LearnCurriculum): string {
  const dueCount = getDueReviewCardIds(current, progressState).length;
  const resumeStepId = progressState.currentStepId ?? getNextStepId(current, progressState);
  const summary = progressSummary();

  return `<section class="learn-shell">
    <section class="learn-shell-header">
      <div>
        <p class="eyebrow">Interactive IPA course</p>
        <h2>${route.view === "progress" ? "Progress" : "Pick up where you left off"}</h2>
        <p class="status-note">Local progress only. No account required.</p>
      </div>
      <div class="learn-summary-card">
        <strong>${summary.completed}/${summary.total}</strong>
        <span>steps completed</span>
        <span>${dueCount} review card${dueCount === 1 ? "" : "s"} due</span>
        <span>${progressState.streak.currentDays} day streak</span>
      </div>
    </section>
    ${renderProgressBar(summary.ratio)}
    <section class="panel">
      <h3>Resume</h3>
      <p>${resumeStepId ? `Your next lesson is <code>${escapeHtml(resumeStepId)}</code>.` : "You have completed the current track."}</p>
      <div class="hero-actions">
        ${
          resumeStepId
            ? `<button type="button" class="button-link" data-action="resume-course" data-step-id="${escapeHtml(resumeStepId)}">Continue learning</button>`
            : `<button type="button" class="button-link" data-action="restart-course">Review from the start</button>`
        }
        <a class="button-link subtle" href="/learn-ipa/reference/">Reference</a>
      </div>
    </section>
    ${renderSettings()}
    <section class="panel">
      <h3>Modules</h3>
      <p class="status-note">The course stays sequential on purpose: small wins first, international patterns later.</p>
      ${renderModuleCards(current)}
    </section>
  </section>`;
}

function renderExampleCard(example: LessonExample, accent: "en-US" | "en-GB"): string {
  const revealed = session.revealedExampleIds.includes(example.id);
  const audio = getExampleAudio(example, accent);

  return `<article class="learn-example-card">
    <div class="variant-header">
      <div>
        <p class="learn-example-ipa">${escapeHtml(getExampleIpa(example, accent))}</p>
        <p class="variant-locale">${escapeHtml(example.meaningGloss)}</p>
      </div>
      <button type="button" class="button-link subtle" data-action="play-example" data-example-id="${escapeHtml(example.id)}">${
        audio?.src || audio?.speechText ? "Play" : "No audio"
      }</button>
    </div>
    ${
      revealed
        ? `<p><strong>${escapeHtml(example.display)}</strong> · ${escapeHtml(example.originLanguage)}</p>`
        : `<button type="button" class="button-link subtle" data-action="reveal-example" data-example-id="${escapeHtml(example.id)}">Reveal word</button>`
    }
  </article>`;
}

function renderTeachStep(current: LearnCurriculum, step: LearnStep): string {
  const maps = getMaps(current);
  const accent = progressState.settings.accent;

  if (step.type === "teach-symbol") {
    const symbol = maps.symbols.get(step.symbolId);
    const examples = getExamplesById(current, step.exampleIds);

    return `<section class="panel learn-step-panel">
      <div class="learn-step-hero">
        <div>
          <p class="eyebrow">Teach symbol</p>
          <h2>${escapeHtml(symbol?.symbol ?? step.symbolId)}</h2>
          <p class="hero-gloss">${escapeHtml(symbol?.name ?? "New IPA symbol")}</p>
        </div>
        <div class="learn-symbol-block">${escapeHtml(symbol?.symbol ?? step.symbolId)}</div>
      </div>
      <p>${escapeHtml(symbol?.notes.join(" ") ?? step.objective)}</p>
      <div class="learn-example-grid">
        ${examples.map((example) => renderExampleCard(example, accent)).join("")}
      </div>
      <details class="learn-hint">
        <summary>Need a hint?</summary>
        <p>${escapeHtml(step.objective)}</p>
      </details>
    </section>`;
  }

  if (step.type === "teach-concept") {
    const concept = maps.concepts.get(step.conceptId);
    const examples = getExamplesById(current, step.exampleIds);

    return `<section class="panel learn-step-panel">
      <p class="eyebrow">Teach concept</p>
      <h2>${escapeHtml(concept?.title ?? step.title)}</h2>
      <p class="hero-gloss">${escapeHtml(concept?.summary ?? step.objective)}</p>
      ${concept?.bodyHtml ?? ""}
      <div class="learn-example-grid">
        ${examples.map((example) => renderExampleCard(example, accent)).join("")}
      </div>
    </section>`;
  }

  return "";
}

function renderDecodeStep(current: LearnCurriculum, step: LearnStep): string {
  if (step.type !== "decode-word" && step.type !== "bonus-round") {
    return "";
  }

  const accent = progressState.settings.accent;
  const examples =
    step.type === "bonus-round" ? getBonusRoundExamples(current, step) : getExamplesById(current, step.exampleIds);

  if (step.type === "bonus-round") {
    const activeIndex = examples.length > 0 ? session.drillIndex % examples.length : 0;
    const activeExample = examples[activeIndex] ?? null;
    const loadingExpandedSet = step.drillExampleIds.length > 0 && !drillLexicon && !drillLexiconError;
    const loadingMessage = loadingExpandedSet
      ? `<p class="status-note">Loading the expanded drill set. Starter words are ready now.</p>`
      : drillLexiconError && step.drillExampleIds.length > 0
        ? `<p class="status-note">Expanded drill set unavailable right now. Using starter words instead.</p>`
        : "";

    return `<section class="panel learn-step-panel">
      <p class="eyebrow">Drill mode</p>
      <h2>${escapeHtml(step.title)}</h2>
      <p class="hero-gloss">${escapeHtml(step.objective)}</p>
      <p class="status-note">${examples.length > 0 ? `Word ${activeIndex + 1} of ${examples.length}` : "No drill words ready yet."}</p>
      ${loadingMessage}
      ${
        activeExample
          ? `<div class="learn-example-grid">${renderExampleCard(activeExample, accent)}</div>`
          : ""
      }
      ${
        examples.length > 1
          ? `<div class="hero-actions">
              <button type="button" class="button-link subtle" data-action="next-drill-example">Next word</button>
            </div>`
          : ""
      }
      <details class="learn-hint">
        <summary>Need a hint?</summary>
        <p>Say what you think the word is before revealing it. Then keep advancing through the drill set while the pattern is still fresh.</p>
      </details>
    </section>`;
  }

  return `<section class="panel learn-step-panel">
    <p class="eyebrow">Decode word</p>
    <h2>${escapeHtml(step.title)}</h2>
    <p class="hero-gloss">${escapeHtml(step.objective)}</p>
    <div class="learn-example-grid">
      ${examples.map((example) => renderExampleCard(example, accent)).join("")}
    </div>
    <details class="learn-hint">
      <summary>Need a hint?</summary>
      <p>Say what you think the word is before revealing it. Then compare your guess with the audio.</p>
    </details>
  </section>`;
}

function renderListenMatchStep(current: LearnCurriculum, step: LearnStep): string {
  if (step.type !== "listen-match") {
    return "";
  }

  const maps = getMaps(current);
  const accent = progressState.settings.accent;
  const promptExample = getExampleById(current, step.promptExampleId);
  const selectedExample = session.listenSelection ? getExampleById(current, session.listenSelection) : null;

  return `<section class="panel learn-step-panel">
    <p class="eyebrow">Listen and match</p>
    <h2>${escapeHtml(step.title)}</h2>
    <p class="hero-gloss">${escapeHtml(step.objective)}</p>
    <div class="hero-actions">
      ${
        promptExample
          ? `<button type="button" class="button-link" data-action="play-example" data-example-id="${escapeHtml(promptExample.id)}">Play prompt audio</button>`
          : ""
      }
    </div>
    <div class="learn-choice-grid">
      ${step.choiceExampleIds
        .map((exampleId) => getExampleById(current, exampleId))
        .filter((example): example is LessonExample => !!example)
        .map(
          (example) => `<button type="button" class="learn-choice${
            session.listenSelection === example.id ? " is-selected" : ""
          }" data-action="select-listen-choice" data-example-id="${escapeHtml(example.id)}">
            <span class="learn-example-ipa">${escapeHtml(getExampleIpa(example, accent))}</span>
            <span>${escapeHtml(example.meaningGloss)}</span>
          </button>`
        )
        .join("")}
    </div>
    ${
      session.listenSelection
        ? `<p class="learn-feedback ${
            session.listenSelection === step.promptExampleId ? "is-correct" : "is-incorrect"
          }">${
            session.listenSelection === step.promptExampleId
              ? "Correct. The audio matches that IPA choice."
              : `Not quite. The prompt was ${escapeHtml(getExampleIpa(promptExample!, accent))}.`
          }</p>`
        : ""
    }
    ${
      selectedExample
        ? `<div class="learn-example-grid">${renderExampleCard(selectedExample, accent)}</div>`
        : ""
    }
  </section>`;
}

function renderReviewCard(current: LearnCurriculum, card: ReviewCard): string {
  const maps = getMaps(current);
  const accent = progressState.settings.accent;

  if (card.kind === "symbol" && card.symbolId) {
    const symbol = maps.symbols.get(card.symbolId);
    return `<div class="learn-review-card">
      <p class="eyebrow">Review symbol</p>
      <h3>${escapeHtml(symbol?.symbol ?? card.symbolId)}</h3>
      <p>${escapeHtml(card.prompt)}</p>
      ${
        session.reviewReveal && symbol
          ? `<p><strong>${escapeHtml(symbol.name)}</strong> · ${escapeHtml(symbol.notes.join(" "))}</p>`
          : ""
      }
    </div>`;
  }

  if (card.kind === "concept" && card.conceptId) {
    const concept = maps.concepts.get(card.conceptId);
    return `<div class="learn-review-card">
      <p class="eyebrow">Review concept</p>
      <h3>${escapeHtml(concept?.title ?? card.conceptId)}</h3>
      <p>${escapeHtml(card.prompt)}</p>
      ${session.reviewReveal && concept ? concept.bodyHtml : ""}
    </div>`;
  }

  if (card.kind === "example" && card.exampleId) {
    const example = getExampleById(current, card.exampleId);
    return `<div class="learn-review-card">
      <p class="eyebrow">Review example</p>
      <h3 class="learn-example-ipa">${escapeHtml(example ? getExampleIpa(example, accent) : card.prompt)}</h3>
      <p>${escapeHtml(card.prompt)}</p>
      ${
        session.reviewReveal && example
          ? `<div class="learn-example-grid">${renderExampleCard(example, accent)}</div>`
          : ""
      }
    </div>`;
  }

  return `<div class="learn-review-card"><p>${escapeHtml(card.prompt)}</p></div>`;
}

function renderReviewStep(current: LearnCurriculum, step: LearnStep): string {
  if (step.type !== "review-round") {
    return "";
  }

  const reviewState = introduceReviewCards(progressState, step.reviewCardIds);
  const cards = getReviewCardsForStep(current, reviewState, step);
  const maps = getMaps(current);
  const hasPendingExpandedCards = cards.some(
    (card) => !!card.exampleId && !maps.examples.has(card.exampleId) && !maps.drillExamples.has(card.exampleId)
  );

  if (hasPendingExpandedCards && !drillLexicon && !drillLexiconPromise) {
    void ensureDrillLexicon();
  }

  if (hasPendingExpandedCards && !drillLexicon && !drillLexiconError) {
    return `<section class="panel learn-step-panel">
      <p class="eyebrow">Review round</p>
      <h2>${escapeHtml(step.title)}</h2>
      <p class="hero-gloss">Loading the expanded review deck for this unit.</p>
    </section>`;
  }

  const visibleCards =
    drillLexiconError && hasPendingExpandedCards
      ? cards.filter((card) => !card.exampleId || !!getExampleFromMaps(maps, card.exampleId))
      : cards;
  const card = visibleCards[session.reviewIndex] ?? null;

  if (!card) {
    return `<section class="panel learn-step-panel">
      <p class="eyebrow">Review complete</p>
      <h2>${escapeHtml(step.title)}</h2>
      <p class="hero-gloss">You cleared the current review batch. Move on while the pattern is still warm.</p>
    </section>`;
  }

  return `<section class="panel learn-step-panel">
    <p class="eyebrow">Review round</p>
    <h2>${escapeHtml(step.title)}</h2>
    <p class="hero-gloss">Card ${session.reviewIndex + 1} of ${visibleCards.length}</p>
    ${
      drillLexiconError && hasPendingExpandedCards
        ? `<p class="status-note">Some expanded drill-backed review cards are unavailable right now.</p>`
        : ""
    }
    ${renderReviewCard(current, card)}
    <div class="hero-actions">
      <button type="button" class="button-link subtle" data-action="reveal-review">Reveal answer</button>
      ${
        card.exampleId
          ? `<button type="button" class="button-link subtle" data-action="play-example" data-example-id="${escapeHtml(card.exampleId)}">Hear example</button>`
          : ""
      }
    </div>
    <div class="learn-review-actions">
      ${(["failed", "hard", "good", "easy"] as ReviewOutcome[])
        .map(
          (outcome) =>
            `<button type="button" class="learn-review-button" data-action="rate-review" data-card-id="${escapeHtml(card.id)}" data-outcome="${escapeHtml(
              outcome
            )}">${escapeHtml(outcome)}</button>`
        )
        .join("")}
    </div>
  </section>`;
}

function getMicPracticeExample(current: LearnCurriculum, step: LearnStep): LessonExample | null {
  if (step.type === "bonus-round") {
    const examples = getBonusRoundExamples(current, step);
    return examples.length > 0 ? examples[session.drillIndex % examples.length] ?? examples[0] ?? null : null;
  }

  if ("exampleIds" in step) {
    return getExampleById(current, step.exampleIds[0] ?? "");
  }

  if (step.type === "listen-match") {
    return getExampleById(current, step.promptExampleId);
  }

  if (step.type === "review-round") {
    const cards = getReviewCardsForStep(current, introduceReviewCards(progressState, step.reviewCardIds), step);
    const activeExampleId = cards[session.reviewIndex]?.exampleId ?? step.fallbackExampleIds[0] ?? null;
    return activeExampleId ? getExampleById(current, activeExampleId) : null;
  }

  if (step.type === "mic-check") {
    return getExampleById(current, step.exampleId);
  }

  return null;
}

function renderMicPracticePanel(example: LessonExample | null): string {
  if (!example || progressState.settings.micMode === "off") {
    return "";
  }

  const supported = canUseMicPractice();
  const unavailableMessage =
    !supported ? `<p class="status-note">Mic capture is not supported in this browser.</p>` : "";
  const experimentalNote =
    progressState.settings.micMode === "experimental-score"
      ? `<p class="status-note">Experimental scoring is not enabled in this build. Manual compare-only mode is still available.</p>`
      : "";

  return `<section class="panel learn-step-panel">
    <p class="eyebrow">Mic practice</p>
    <h3>Say ${escapeHtml(example.display)}</h3>
    <p class="hero-gloss">Record one attempt, then compare your playback with the lesson audio. No automatic score.</p>
    ${experimentalNote}
    ${unavailableMessage}
    <div class="hero-actions">
      ${
        supported
          ? session.recordingState === "recording"
            ? `<button type="button" class="button-link" data-action="stop-recording">Stop recording</button>`
            : `<button type="button" class="button-link" data-action="start-recording">Record yourself</button>`
          : `<button type="button" class="button-link subtle" disabled>Mic unavailable</button>`
      }
      ${
        session.recordingUrl
          ? `<button type="button" class="button-link subtle" data-action="clear-recording">Discard clip</button>`
          : ""
      }
    </div>
    ${
      session.recordingState === "recording"
        ? `<p class="learn-feedback">Recording. Say it once, then stop when you are ready.</p>`
        : ""
    }
    ${
      session.recordingError
        ? `<p class="learn-feedback is-incorrect">${escapeHtml(session.recordingError)}</p>`
        : ""
    }
    ${
      session.recordingUrl
        ? `<div class="learn-review-card">
            <p class="eyebrow">Your playback</p>
            <audio controls preload="metadata" src="${escapeHtml(session.recordingUrl)}"></audio>
          </div>`
        : ""
    }
  </section>`;
}

function renderStepView(current: LearnCurriculum, step: LearnStep): string {
  const summary = progressSummary();
  const module = current.modules.find((candidate) => candidate.id === step.moduleId);
  const moduleProgress = module ? getModuleProgress(current, progressState, module.id) : { completed: 0, total: 0, ratio: 0 };
  const micPractice = renderMicPracticePanel(getMicPracticeExample(current, step));

  const body =
    step.type === "teach-symbol" || step.type === "teach-concept"
      ? renderTeachStep(current, step)
      : step.type === "decode-word" || step.type === "bonus-round"
        ? renderDecodeStep(current, step)
        : step.type === "listen-match"
          ? renderListenMatchStep(current, step)
          : renderReviewStep(current, step);

  return `<section class="learn-shell">
    <section class="learn-shell-header">
      <div>
        <p class="eyebrow">${escapeHtml(module?.title ?? "Learn IPA")}</p>
        <h2>${escapeHtml(step.title)}</h2>
        <p class="status-note">${escapeHtml(step.objective)}</p>
      </div>
      <div class="learn-summary-card">
        <span>${summary.completed}/${summary.total} overall</span>
        <span>${moduleProgress.completed}/${moduleProgress.total} in module</span>
      </div>
    </section>
    ${renderProgressBar(summary.ratio)}
    <div class="meta-row">
      <button type="button" class="button-link subtle" data-action="show-overview">Back to course map</button>
      <a class="button-link subtle" href="/learn-ipa/reference/">Reference</a>
    </div>
    ${body}
    ${micPractice}
    ${renderSettings()}
    <div class="hero-actions">
      <button type="button" class="button-link" data-action="complete-step">Continue</button>
      ${
        progressState.currentStepId && progressState.currentStepId !== step.id
          ? `<button type="button" class="button-link subtle" data-action="resume-course" data-step-id="${escapeHtml(progressState.currentStepId)}">Jump to saved step</button>`
          : ""
      }
    </div>
  </section>`;
}

function maybeAutoplayStep(step: LearnStep): void {
  if (!curriculum || !hasGesture || !progressState.settings.autoplayAfterGesture || lastAutoplayStepId === step.id) {
    return;
  }

  const example =
    step.type === "bonus-round"
      ? getBonusRoundExamples(curriculum, step)[0] ?? null
      : "exampleIds" in step
        ? getExampleById(curriculum, step.exampleIds[0] ?? "")
        : step.type === "listen-match"
          ? getExampleById(curriculum, step.promptExampleId)
          : step.type === "mic-check"
            ? getExampleById(curriculum, step.exampleId)
            : null;

  if (!example) {
    return;
  }

  lastAutoplayStepId = step.id;
  window.setTimeout(() => {
    void playExample(example);
  }, 120);
}

function triggerCelebration(): void {
  if (!root || progressState.settings.reducedMotion) {
    return;
  }

  const burst = document.createElement("div");
  burst.className = "learn-celebration";

  for (let index = 0; index < 12; index += 1) {
    const piece = document.createElement("span");
    piece.style.setProperty("--offset", `${index * 30}deg`);
    piece.style.setProperty("--delay", `${index * 16}ms`);
    burst.appendChild(piece);
  }

  root.appendChild(burst);
  window.setTimeout(() => burst.remove(), 680);
}

function completeCurrentStep(): void {
  if (!curriculum) {
    return;
  }

  const step = getActiveStep();
  if (!step) {
    return;
  }

  let correct = 1;

  if (step.type === "listen-match") {
    if (!session.listenSelection) {
      return;
    }
    correct = session.listenSelection === step.promptExampleId ? 1 : 0;
  }

  if (step.type === "review-round") {
    const cards = getReviewCardsForStep(curriculum, progressState, step);
    if (cards.length > 0 && session.reviewIndex < cards.length) {
      return;
    }
  }

  progressState = recordStepAttempt(progressState, step.id, correct);
  progressState = markStepCompleted(curriculum, progressState, step.id);
  progressState = ensureLearnIpaState(progressState, curriculum);
  saveProgress();
  triggerCelebration();

  const nextStepId = progressState.currentStepId;
  window.setTimeout(() => {
    if (nextStepId && nextStepId !== step.id) {
      updateRoute(
        {
          stepId: nextStepId,
          moduleId: route.moduleId ?? step.moduleId,
          view: "overview"
        },
        false
      );
    } else {
      updateRoute({ stepId: null, moduleId: null, view: "progress" }, false);
    }
  }, progressState.settings.reducedMotion ? 0 : 380);
}

function render(): void {
  if (!root || !curriculum) {
    return;
  }

  progressState = ensureLearnIpaState(progressState, curriculum);

  const step = getActiveStep();
  ensureSession(step?.id ?? null);

  root.innerHTML = step ? renderStepView(curriculum, step) : renderOverview(curriculum);

  if (step) {
    maybeAutoplayStep(step);
  }
}

async function handleClick(event: Event): Promise<void> {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !curriculum) {
    return;
  }

  const actionElement = target.closest<HTMLElement>("[data-action]");
  if (!actionElement) {
    return;
  }

  const action = actionElement.dataset.action;
  if (!action) {
    return;
  }

  markInteracted();

  if (action === "show-overview") {
    updateRoute({ stepId: null, moduleId: null, view: "overview" });
    return;
  }

  if (action === "resume-course") {
    const stepId = actionElement.dataset.stepId ?? progressState.currentStepId;
    if (stepId) {
      updateRoute({ stepId, moduleId: route.moduleId, view: "overview" });
    }
    return;
  }

  if (action === "restart-course") {
    window.localStorage.removeItem(LEARN_IPA_STORAGE_KEY);
    loadProgress();
    updateRoute({ stepId: progressState.currentStepId, moduleId: curriculum.modules[0]?.id ?? null, view: "overview" });
    return;
  }

  if (action === "open-module") {
    const stepId = actionElement.dataset.stepId ?? null;
    const moduleId = actionElement.dataset.moduleId ?? null;
    if (stepId) {
      updateRoute({ stepId, moduleId, view: "overview" });
    }
    return;
  }

  if (action === "play-example") {
    const exampleId = actionElement.dataset.exampleId;
    if (!exampleId) {
      return;
    }
    const example = getExampleById(curriculum, exampleId);
    if (example) {
      await playExample(example);
    }
    return;
  }

  if (action === "start-recording") {
    await startMicPractice();
    return;
  }

  if (action === "stop-recording") {
    stopMicPractice();
    return;
  }

  if (action === "clear-recording") {
    revokeRecordingUrl(session.recordingUrl);
    session.recordingUrl = null;
    session.recordingError = null;
    render();
    return;
  }

  if (action === "reveal-example") {
    const exampleId = actionElement.dataset.exampleId;
    if (exampleId && !session.revealedExampleIds.includes(exampleId)) {
      session.revealedExampleIds = [...session.revealedExampleIds, exampleId];
      render();
    }
    return;
  }

  if (action === "select-listen-choice") {
    const exampleId = actionElement.dataset.exampleId;
    if (exampleId) {
      session.listenSelection = exampleId;
      render();
    }
    return;
  }

  if (action === "next-drill-example") {
    session.drillIndex += 1;
    render();
    return;
  }

  if (action === "reveal-review") {
    session.reviewReveal = true;
    render();
    return;
  }

  if (action === "rate-review") {
    const cardId = actionElement.dataset.cardId;
    const outcome = actionElement.dataset.outcome as ReviewOutcome | undefined;
    if (!cardId || !outcome) {
      return;
    }

    progressState = applyReviewOutcome(progressState, cardId, outcome);
    saveProgress();
    session.reviewIndex += 1;
    session.reviewReveal = false;
    render();
    return;
  }

  if (action === "complete-step") {
    completeCurrentStep();
  }
}

function handleChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action) {
    return;
  }

  if (action === "set-accent" && (target.value === "en-US" || target.value === "en-GB")) {
    progressState.settings.accent = target.value;
  }

  if (action === "set-rate" && (target.value === "1" || target.value === "0.5")) {
    progressState.settings.playbackRateDefault = target.value === "0.5" ? 0.5 : 1;
  }

  if (action === "toggle-autoplay" && target instanceof HTMLInputElement) {
    progressState.settings.autoplayAfterGesture = target.checked;
  }

  if (action === "toggle-motion" && target instanceof HTMLInputElement) {
    progressState.settings.reducedMotion = target.checked;
  }

  if (action === "set-mic-mode" && (target.value === "off" || target.value === "record-only")) {
    progressState.settings.micMode = target.value;
  }

  saveProgress();
  render();
}

async function init(): Promise<void> {
  root = document.querySelector<HTMLElement>("#learn-ipa-app");
  if (!root) {
    return;
  }

  const curriculumSrc = root.dataset.curriculumSrc ?? "/learn-ipa/curriculum.json";
  const response = await fetch(curriculumSrc);

  if (!response.ok) {
    root.innerHTML = `<p class="status-note">The course data could not be loaded right now.</p>`;
    return;
  }

  curriculum = (await response.json()) as LearnCurriculum;
  loadProgress();
  route = readRoute();

  const initialView = root.dataset.initialView;
  if (!new URL(window.location.href).searchParams.get("view") && initialView === "progress" && route.view !== "progress") {
    route.view = "progress";
  }

  if (route.stepId && !curriculum.steps.some((step) => step.id === route.stepId)) {
    route.stepId = progressState.currentStepId;
    updateRoute(route, true);
    return;
  }

  root.addEventListener("click", (event) => {
    void handleClick(event);
  });
  root.addEventListener("change", handleChange);

  window.addEventListener("popstate", () => {
    route = readRoute();
    render();
  });

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/learn-ipa/sw.js", { scope: LEARN_IPA_ROOT_PATH }).catch(() => {});
  }

  render();
}

void init();
