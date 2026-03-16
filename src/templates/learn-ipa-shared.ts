import { escapeHtml } from "../lib/html";
import {
  LEARN_IPA_ABOUT_PATH,
  LEARN_IPA_REFERENCE_PATH,
  getLearnIpaAppPath,
  getLearnIpaModulePath
} from "../lib/learn-ipa/routes";
import type { LearnCurriculum, ModuleSummary } from "../types/learn-ipa";

function findModuleStartStepId(module: ModuleSummary): string | null {
  return module.stepIds[0] ?? null;
}

export function getLearnIpaSymbolAnchorId(symbolId: string): string {
  return `symbol-${encodeURIComponent(symbolId)}`;
}

export function renderLearnIpaModuleCards(curriculum: LearnCurriculum): string {
  return `<div class="learn-module-grid">
    ${curriculum.modules
      .map((module) => {
        const startStepId = findModuleStartStepId(module);
        return `<article class="learn-module-card">
          <p class="eyebrow">Module</p>
          <h3><a href="${escapeHtml(getLearnIpaModulePath(module.slug))}">${escapeHtml(module.title)}</a></h3>
          <p>${escapeHtml(module.summary)}</p>
          <div class="meta-row">
            <span>${module.unitIds.length} units</span>
            <span>${module.stepIds.length} steps</span>
            <span>${module.symbolIds.length} symbols</span>
          </div>
          <div class="hero-actions">
            ${
              startStepId
                ? `<a class="button-link" href="${escapeHtml(getLearnIpaAppPath({ stepId: startStepId, moduleId: module.id }))}">Start module</a>`
                : ""
            }
            <a class="button-link subtle" href="${escapeHtml(getLearnIpaModulePath(module.slug))}">Overview</a>
          </div>
        </article>`;
      })
      .join("")}
  </div>`;
}

export function renderLearnIpaQuickLinks(): string {
  return `<div class="hero-actions">
    <a class="button-link" href="${escapeHtml(getLearnIpaAppPath())}">Open the course</a>
    <a class="button-link subtle" href="${escapeHtml(LEARN_IPA_REFERENCE_PATH)}">Reference</a>
    <a class="button-link subtle" href="${escapeHtml(LEARN_IPA_ABOUT_PATH)}">About the course</a>
  </div>`;
}

export function renderLearnIpaSymbolPills(curriculum: LearnCurriculum, symbolIds: string[]): string {
  const symbolsById = new Map(curriculum.symbols.map((symbol) => [symbol.id, symbol]));

  return `<div class="meta-row">
    ${symbolIds
      .map((symbolId) => symbolsById.get(symbolId))
      .filter((symbol): symbol is NonNullable<typeof symbol> => !!symbol)
      .map(
        (symbol) =>
          `<a class="learn-pill" href="${escapeHtml(
            `${LEARN_IPA_REFERENCE_PATH}#${getLearnIpaSymbolAnchorId(symbol.id)}`
          )}">${escapeHtml(symbol.symbol)} · ${escapeHtml(symbol.name)}</a>`
      )
      .join("")}
  </div>`;
}

export function renderLearnIpaConceptPills(curriculum: LearnCurriculum, conceptIds: string[]): string {
  const conceptsById = new Map(curriculum.concepts.map((concept) => [concept.id, concept]));

  return `<div class="meta-row">
    ${conceptIds
      .map((conceptId) => conceptsById.get(conceptId))
      .filter((concept): concept is NonNullable<typeof concept> => !!concept)
      .map((concept) => `<span class="learn-pill learn-pill-muted">${escapeHtml(concept.title)}</span>`)
      .join("")}
  </div>`;
}
