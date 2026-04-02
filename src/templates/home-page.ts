import { escapeHtml } from "../lib/html";
import { getLearnIpaAppPath, LEARN_IPA_REFERENCE_PATH } from "../lib/learn-ipa/routes";
import { getWordPath } from "../lib/shards";
import type { Entry } from "../types/content";
import type { SiteConfig } from "../lib/site-config";
import type { LearnCurriculum } from "../types/learn-ipa";
import { renderLayout } from "./layout";
import { renderLearnIpaModuleCards } from "./learn-ipa-shared";

export function renderHomePage(
  featuredEntries: Entry[],
  totalEntries: number,
  curriculum: LearnCurriculum,
  config: SiteConfig
): string {
  const practiceWords = featuredEntries.slice(0, 10);
  const main = `<section class="hero hero-home">
    <p class="eyebrow">Learn IPA</p>
    <h1>Master IPA through short lessons and real words.</h1>
    <p class="hero-gloss">The curriculum is the main event. The pronunciation pages are there to turn fresh symbols into real reading practice.</p>
    <div class="hero-actions">
      <a class="button-link" href="${escapeHtml(getLearnIpaAppPath())}">Start curriculum</a>
      <a class="button-link subtle" href="/learn-ipa/progress/">Resume</a>
      <a class="button-link subtle" href="/browse/">Word pages</a>
    </div>
    <div class="meta-row">
      <span>${curriculum.modules.length} modules</span>
      <span>${curriculum.steps.length} short steps</span>
      <span>${curriculum.reviewCards.length} review cards</span>
      <span>${totalEntries} word pages</span>
    </div>
  </section>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Curriculum</p>
        <h2>Work top to bottom like a learning track.</h2>
        <p class="status-note">Each module stays small: teach, practice, drill, review.</p>
      </div>
      <a class="button-link subtle" href="${escapeHtml(getLearnIpaAppPath())}">Open the interactive track</a>
    </div>
    ${renderLearnIpaModuleCards(curriculum)}
  </section>
  <section class="panel split-panels">
    <div>
      <p class="eyebrow">Word pages</p>
      <h2>Use real words once a symbol family starts to stick.</h2>
      <p class="status-note">Search directly or pick a few high-value pages to practice on.</p>
      <form class="search-form" data-site-search-form role="search" aria-label="Search pronunciation pages">
        <label class="sr-only" for="home-word-search">Search words</label>
        <input id="home-word-search" type="search" name="q" placeholder="Search a word or name">
        <button type="submit" class="button-link">Open word page</button>
      </form>
      <ul class="entry-grid compact-entry-grid">
        ${practiceWords
          .map(
            (entry) =>
              `<li><a href="${escapeHtml(getWordPath(entry.slug))}">${escapeHtml(entry.display)}</a><p>${escapeHtml(
                entry.shortGloss ?? entry.glosses[0] ?? ""
              )}</p></li>`
          )
          .join("")}
      </ul>
    </div>
    <div>
      <p class="eyebrow">Reference</p>
      <h2>Keep the reference close, but let the lessons drive.</h2>
      <ul class="gloss-list compact-list">
        <li>Open the symbol reference when you need a quick lookup.</li>
        <li>Use the word pages to reinforce symbols after the lesson that teaches them.</li>
        <li>Come back to the review deck until the shapes feel automatic.</li>
      </ul>
      <div class="hero-actions">
        <a class="button-link subtle" href="${escapeHtml(LEARN_IPA_REFERENCE_PATH)}">Open reference</a>
        <a class="button-link subtle" href="/browse/">Browse all ${totalEntries} word pages</a>
      </div>
    </div>
  </section>`;

  return renderLayout(config, {
    title: `${config.siteName} | ${config.siteTagline}`,
    description: config.siteDescription,
    pathname: "/",
    main
  });
}
