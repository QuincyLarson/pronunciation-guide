import type {
  LearnCurriculum,
  LearnIpaState,
  LearnStep,
  ReviewCard,
  ReviewOutcome
} from "../../types/learn-ipa";

export const LEARN_IPA_STORAGE_KEY = "pronunciation-guide.learn-ipa";
export const LEARN_IPA_STATE_VERSION = 1;

type LessonAttempt = LearnIpaState["lessonAttempts"][string];
type ReviewStats = LearnIpaState["symbolStats"][string];

const DEFAULT_SETTINGS: LearnIpaState["settings"] = {
  accent: "en-US",
  reducedMotion: false,
  autoplayAfterGesture: true,
  micMode: "off",
  playbackRateDefault: 1
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function toLocalDateString(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(now: Date, days: number): string {
  const next = new Date(now);
  next.setTime(next.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

function createDefaultAttempt(now: Date): LessonAttempt {
  return {
    attempts: 0,
    correct: 0,
    lastSeenAt: now.toISOString()
  };
}

function createDefaultReviewStats(): ReviewStats {
  return {
    introduced: false,
    confidence: 0.18,
    dueAt: null,
    intervalDays: 0,
    ease: 2.4,
    lapses: 0,
    successes: 0
  };
}

export function createEmptyLearnIpaState(): LearnIpaState {
  return {
    version: LEARN_IPA_STATE_VERSION,
    currentStepId: null,
    completedStepIds: [],
    unlockedModuleIds: [],
    lessonAttempts: {},
    symbolStats: {},
    reviewQueue: [],
    settings: { ...DEFAULT_SETTINGS },
    streak: {
      currentDays: 0,
      lastStudyDate: null
    }
  };
}

function coerceAttempt(value: unknown, now: Date): LessonAttempt {
  const record = isRecord(value) ? value : {};
  const fallback = createDefaultAttempt(now);

  return {
    attempts: typeof record.attempts === "number" ? Math.max(0, Math.round(record.attempts)) : fallback.attempts,
    correct: typeof record.correct === "number" ? Math.max(0, Math.round(record.correct)) : fallback.correct,
    lastSeenAt: typeof record.lastSeenAt === "string" ? record.lastSeenAt : fallback.lastSeenAt
  };
}

function coerceReviewStats(value: unknown): ReviewStats {
  const record = isRecord(value) ? value : {};
  const fallback = createDefaultReviewStats();

  return {
    introduced: typeof record.introduced === "boolean" ? record.introduced : fallback.introduced,
    confidence:
      typeof record.confidence === "number" ? clamp(record.confidence) : fallback.confidence,
    dueAt: typeof record.dueAt === "string" || record.dueAt === null ? record.dueAt : fallback.dueAt,
    intervalDays:
      typeof record.intervalDays === "number" ? Math.max(0, record.intervalDays) : fallback.intervalDays,
    ease: typeof record.ease === "number" ? clamp(record.ease, 1.3, 3.5) : fallback.ease,
    lapses: typeof record.lapses === "number" ? Math.max(0, Math.round(record.lapses)) : fallback.lapses,
    successes:
      typeof record.successes === "number" ? Math.max(0, Math.round(record.successes)) : fallback.successes
  };
}

export function migrateLearnIpaState(value: unknown): LearnIpaState {
  const now = new Date();
  const record = isRecord(value) ? value : {};
  const state = createEmptyLearnIpaState();
  const rawSettings = isRecord(record.settings) ? record.settings : {};
  const rawLessonAttempts = isRecord(record.lessonAttempts) ? record.lessonAttempts : {};
  const rawSymbolStats = isRecord(record.symbolStats) ? record.symbolStats : {};
  const rawStreak = isRecord(record.streak) ? record.streak : {};

  return {
    version: LEARN_IPA_STATE_VERSION,
    currentStepId: typeof record.currentStepId === "string" ? record.currentStepId : null,
    completedStepIds: unique(asStringArray(record.completedStepIds)),
    unlockedModuleIds: unique(asStringArray(record.unlockedModuleIds)),
    lessonAttempts: Object.fromEntries(
      Object.entries(rawLessonAttempts).map(([stepId, attempt]) => [stepId, coerceAttempt(attempt, now)])
    ),
    symbolStats: Object.fromEntries(
      Object.entries(rawSymbolStats).map(([cardId, stats]) => [cardId, coerceReviewStats(stats)])
    ),
    reviewQueue: unique(asStringArray(record.reviewQueue)),
    settings: {
      accent: rawSettings.accent === "en-GB" ? "en-GB" : state.settings.accent,
      reducedMotion:
        typeof rawSettings.reducedMotion === "boolean"
          ? rawSettings.reducedMotion
          : state.settings.reducedMotion,
      autoplayAfterGesture:
        typeof rawSettings.autoplayAfterGesture === "boolean"
          ? rawSettings.autoplayAfterGesture
          : state.settings.autoplayAfterGesture,
      micMode:
        rawSettings.micMode === "record-only" || rawSettings.micMode === "experimental-score"
          ? rawSettings.micMode
          : state.settings.micMode,
      playbackRateDefault:
        rawSettings.playbackRateDefault === 0.5 ? 0.5 : state.settings.playbackRateDefault
    },
    streak: {
      currentDays:
        typeof rawStreak.currentDays === "number" ? Math.max(0, Math.round(rawStreak.currentDays)) : 0,
      lastStudyDate: typeof rawStreak.lastStudyDate === "string" ? rawStreak.lastStudyDate : null
    }
  };
}

export function ensureLearnIpaState(
  state: LearnIpaState,
  curriculum: LearnCurriculum
): LearnIpaState {
  const next = migrateLearnIpaState(state);

  if (curriculum.modules.length > 0 && next.unlockedModuleIds.length === 0) {
    next.unlockedModuleIds = [curriculum.modules[0].id];
  }

  if (!next.currentStepId) {
    next.currentStepId = getNextStepId(curriculum, next);
  }

  return next;
}

export function getFirstStepIdForModule(curriculum: LearnCurriculum, moduleId: string): string | null {
  return curriculum.modules.find((module) => module.id === moduleId)?.stepIds[0] ?? null;
}

export function getNextStepId(
  curriculum: LearnCurriculum,
  state: LearnIpaState,
  fromStepId?: string | null
): string | null {
  const orderedStepIds = curriculum.steps.map((step) => step.id);

  if (orderedStepIds.length === 0) {
    return null;
  }

  if (fromStepId) {
    const startIndex = orderedStepIds.indexOf(fromStepId);
    for (const stepId of orderedStepIds.slice(Math.max(0, startIndex + 1))) {
      if (!state.completedStepIds.includes(stepId)) {
        return stepId;
      }
    }
  }

  for (const stepId of orderedStepIds) {
    if (!state.completedStepIds.includes(stepId)) {
      return stepId;
    }
  }

  return orderedStepIds[orderedStepIds.length - 1] ?? null;
}

export function getModuleProgress(
  curriculum: LearnCurriculum,
  state: LearnIpaState,
  moduleId: string
): { completed: number; total: number; ratio: number } {
  const module = curriculum.modules.find((candidate) => candidate.id === moduleId);
  if (!module) {
    return { completed: 0, total: 0, ratio: 0 };
  }

  const completed = module.stepIds.filter((stepId) => state.completedStepIds.includes(stepId)).length;
  const total = module.stepIds.length;

  return {
    completed,
    total,
    ratio: total > 0 ? completed / total : 0
  };
}

function updateStreak(streak: LearnIpaState["streak"], now: Date): LearnIpaState["streak"] {
  const today = toLocalDateString(now);
  if (!streak.lastStudyDate) {
    return {
      currentDays: 1,
      lastStudyDate: today
    };
  }

  if (streak.lastStudyDate === today) {
    return {
      currentDays: Math.max(1, streak.currentDays),
      lastStudyDate: today
    };
  }

  const previous = new Date(`${streak.lastStudyDate}T00:00:00`);
  const deltaDays = Math.round((new Date(`${today}T00:00:00`).getTime() - previous.getTime()) / 86400000);

  return {
    currentDays: deltaDays === 1 ? streak.currentDays + 1 : 1,
    lastStudyDate: today
  };
}

export function recordStepAttempt(
  state: LearnIpaState,
  stepId: string,
  correct: number,
  now = new Date()
): LearnIpaState {
  const next = migrateLearnIpaState(state);
  const current = next.lessonAttempts[stepId] ?? createDefaultAttempt(now);

  next.lessonAttempts = {
    ...next.lessonAttempts,
    [stepId]: {
      attempts: current.attempts + 1,
      correct: current.correct + correct,
      lastSeenAt: now.toISOString()
    }
  };
  next.streak = updateStreak(next.streak, now);
  return next;
}

export function introduceReviewCards(
  state: LearnIpaState,
  cardIds: string[],
  now = new Date()
): LearnIpaState {
  const next = migrateLearnIpaState(state);

  next.reviewQueue = unique([...next.reviewQueue, ...cardIds]);
  next.symbolStats = { ...next.symbolStats };

  for (const cardId of cardIds) {
    const current = next.symbolStats[cardId] ?? createDefaultReviewStats();
    next.symbolStats[cardId] = {
      ...current,
      introduced: true,
      dueAt: current.dueAt ?? now.toISOString()
    };
  }

  return next;
}

function scoreConfidence(stats: ReviewStats): number {
  const total = stats.successes + stats.lapses;
  const retention = total > 0 ? stats.successes / total : 0;
  const intervalWeight = clamp(stats.intervalDays / 10);
  return clamp(retention * 0.7 + intervalWeight * 0.3);
}

export function applyReviewOutcome(
  state: LearnIpaState,
  cardId: string,
  outcome: ReviewOutcome,
  now = new Date()
): LearnIpaState {
  const next = introduceReviewCards(state, [cardId], now);
  const current = next.symbolStats[cardId] ?? createDefaultReviewStats();
  const stats: ReviewStats = { ...current, introduced: true };

  if (outcome === "failed") {
    stats.intervalDays = 0.5;
    stats.ease = clamp(stats.ease - 0.2, 1.3, 3.5);
    stats.lapses += 1;
  } else if (outcome === "hard") {
    stats.intervalDays = Math.max(1, stats.intervalDays > 0 ? stats.intervalDays * 1.35 : 1);
    stats.ease = clamp(stats.ease - 0.05, 1.3, 3.5);
    stats.successes += 1;
  } else if (outcome === "good") {
    stats.intervalDays = Math.max(2, stats.intervalDays > 0 ? stats.intervalDays * 2.2 : 2);
    stats.ease = clamp(stats.ease + 0.03, 1.3, 3.5);
    stats.successes += 1;
  } else {
    stats.intervalDays = Math.max(4, stats.intervalDays > 0 ? stats.intervalDays * 3.2 : 4);
    stats.ease = clamp(stats.ease + 0.08, 1.3, 3.5);
    stats.successes += 1;
  }

  stats.dueAt = addDays(now, stats.intervalDays);
  stats.confidence = scoreConfidence(stats);
  next.symbolStats = {
    ...next.symbolStats,
    [cardId]: stats
  };
  return next;
}

export function getDueReviewCardIds(
  curriculum: LearnCurriculum,
  state: LearnIpaState,
  now = new Date()
): string[] {
  const validCardIds = new Set(curriculum.reviewCards.map((card) => card.id));

  return state.reviewQueue.filter((cardId) => {
    if (!validCardIds.has(cardId)) {
      return false;
    }

    const stats = state.symbolStats[cardId];
    if (!stats?.introduced) {
      return true;
    }

    return !stats.dueAt || new Date(stats.dueAt).getTime() <= now.getTime();
  });
}

export function getReviewCardsForStep(
  curriculum: LearnCurriculum,
  state: LearnIpaState,
  step: LearnStep,
  now = new Date()
): ReviewCard[] {
  if (step.type !== "review-round") {
    return [];
  }

  const cardIds = unique([...step.reviewCardIds, ...getDueReviewCardIds(curriculum, state, now)]);
  const byId = new Map(curriculum.reviewCards.map((card) => [card.id, card]));
  return cardIds.map((cardId) => byId.get(cardId)).filter((card): card is ReviewCard => !!card);
}

export function markStepCompleted(
  curriculum: LearnCurriculum,
  state: LearnIpaState,
  stepId: string,
  now = new Date()
): LearnIpaState {
  const next = migrateLearnIpaState(state);
  const step = curriculum.steps.find((candidate) => candidate.id === stepId);
  const completedStepIds = unique([...next.completedStepIds, stepId]);

  next.completedStepIds = completedStepIds;
  next.currentStepId = getNextStepId(curriculum, { ...next, completedStepIds }, stepId);
  next.streak = updateStreak(next.streak, now);

  if (step?.type === "review-round") {
    const afterIntroduce = introduceReviewCards(next, step.reviewCardIds, now);
    afterIntroduce.currentStepId = next.currentStepId;
    afterIntroduce.completedStepIds = completedStepIds;
    next.symbolStats = afterIntroduce.symbolStats;
    next.reviewQueue = afterIntroduce.reviewQueue;
  }

  const orderedModules = curriculum.modules;
  for (const [index, module] of orderedModules.entries()) {
    if (module.stepIds.every((candidateStepId) => completedStepIds.includes(candidateStepId))) {
      const nextModule = orderedModules[index + 1];
      if (nextModule && !next.unlockedModuleIds.includes(nextModule.id)) {
        next.unlockedModuleIds = [...next.unlockedModuleIds, nextModule.id];
      }
    }
  }

  return next;
}
