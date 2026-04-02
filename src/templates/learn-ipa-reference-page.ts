import { escapeHtml } from "../lib/html";
import { LEARN_IPA_ROOT_PATH } from "../lib/learn-ipa/routes";
import type { SiteConfig } from "../lib/site-config";
import type { LearnCurriculum } from "../types/learn-ipa";
import { renderLayout } from "./layout";
import { getLearnIpaSymbolAnchorId } from "./learn-ipa-shared";

export function renderLearnIpaReferencePage(curriculum: LearnCurriculum, config: SiteConfig): string {
  const groups = new Map<string, typeof curriculum.symbols>();

  for (const symbol of curriculum.symbols) {
    const current = groups.get(symbol.class) ?? [];
    current.push(symbol);
    groups.set(symbol.class, current);
  }

  const main = `<section class="hero hero-learn">
    <p class="eyebrow">IPA reference</p>
    <h1>Reference</h1>
    <p class="hero-gloss">Use this when you need a quick symbol lookup. Every entry links back to the lesson that first teaches it.</p>
    <div class="hero-actions">
      <a class="button-link" href="${escapeHtml(LEARN_IPA_ROOT_PATH)}">Open curriculum</a>
      <a class="button-link subtle" href="/browse/">Word pages</a>
    </div>
  </section>
  ${[...groups.entries()]
    .map(
      ([group, symbols]) => `<section class="panel">
        <h2>${escapeHtml(group.replace(/-/g, " "))}</h2>
        <div class="learn-reference-grid">
          ${symbols
            .map(
              (symbol) => `<article id="${escapeHtml(getLearnIpaSymbolAnchorId(symbol.id))}" class="learn-reference-card">
                <div class="variant-header">
                  <div>
                    <h3 class="learn-symbol-glyph">${escapeHtml(symbol.symbol)}</h3>
                    <p class="variant-locale">${escapeHtml(symbol.name)}</p>
                  </div>
                  ${
                    symbol.firstStepId
                      ? `<a class="button-link subtle" href="/learn-ipa/?step=${encodeURIComponent(symbol.firstStepId)}">Lesson</a>`
                      : ""
                  }
                </div>
                ${symbol.notes.length > 0 ? `<p>${escapeHtml(symbol.notes.join(" "))}</p>` : ""}
                <div class="meta-row">
                  <span>Difficulty ${Math.round(symbol.difficulty * 100)}</span>
                  <span>Confusion ${Math.round(symbol.confusionScore * 100)}</span>
                  <span>${symbol.exampleIds.length} examples</span>
                </div>
              </article>`
            )
            .join("")}
        </div>
      </section>`
    )
    .join("")}`;

  return renderLayout(config, {
    title: `IPA Reference | ${config.siteName}`,
    description: "Browse the symbol catalog used by the Learn IPA course and the pronunciation directory.",
    pathname: "/learn-ipa/reference/",
    main
  });
}
