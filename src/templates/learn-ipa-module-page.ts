import { escapeHtml } from "../lib/html";
import { getLearnIpaAppPath, LEARN_IPA_REFERENCE_PATH } from "../lib/learn-ipa/routes";
import type { SiteConfig } from "../lib/site-config";
import type { LearnCurriculum, ModuleSummary } from "../types/learn-ipa";
import { renderLayout } from "./layout";
import { renderLearnIpaConceptPills, renderLearnIpaSymbolPills } from "./learn-ipa-shared";

export function renderLearnIpaModulePage(
  curriculum: LearnCurriculum,
  module: ModuleSummary,
  config: SiteConfig
): string {
  const startStepId = module.stepIds[0] ?? null;
  const main = `<section class="hero hero-learn">
    <p class="eyebrow">Curriculum module</p>
    <h1>${escapeHtml(module.title)}</h1>
    <p class="hero-gloss">${escapeHtml(module.summary)}</p>
    <div class="hero-actions">
      ${
        startStepId
          ? `<a class="button-link" href="${escapeHtml(
              getLearnIpaAppPath({ stepId: startStepId, moduleId: module.id })
            )}">Start module</a>`
          : ""
      }
      <a class="button-link subtle" href="${escapeHtml(getLearnIpaAppPath())}">Back to curriculum</a>
      <a class="button-link subtle" href="${escapeHtml(LEARN_IPA_REFERENCE_PATH)}">Reference symbols</a>
    </div>
    <div class="meta-row">
      <span>${module.unitIds.length} units</span>
      <span>${module.stepIds.length} steps</span>
      <span>${module.symbolIds.length} symbols</span>
    </div>
  </section>
  <section class="panel prose">
    ${module.bodyHtml}
  </section>
  <section class="panel split-panels">
    <div>
      <h2>Symbols</h2>
      ${renderLearnIpaSymbolPills(curriculum, module.symbolIds)}
    </div>
    <div>
      <h2>Concepts</h2>
      ${renderLearnIpaConceptPills(curriculum, module.conceptIds)}
    </div>
  </section>`;

  return renderLayout(config, {
    title: `${module.title} | Learn IPA | ${config.siteName}`,
    description: module.summary,
    pathname: `/learn-ipa/module/${module.slug}/`,
    main
  });
}
