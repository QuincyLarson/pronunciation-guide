import { escapeHtml } from "../lib/html";
import { getLearnIpaAppPath, LEARN_IPA_ABOUT_PATH, LEARN_IPA_REFERENCE_PATH } from "../lib/learn-ipa/routes";
import type { SiteConfig } from "../lib/site-config";
import type { LearnCurriculum } from "../types/learn-ipa";
import { renderLayout } from "./layout";
import { renderLearnIpaModuleCards, renderLearnIpaQuickLinks } from "./learn-ipa-shared";

export function renderLearnIpaPage(curriculum: LearnCurriculum, config: SiteConfig): string {
  const main = `<section class="hero hero-home hero-learn">
    <p class="eyebrow">Interactive IPA course</p>
    <h1>Learn to read the IPA that actually appears on pronunciation pages.</h1>
    <p class="hero-gloss">A short, practice-heavy course for English speakers who want to decode dictionary-style IPA, names, and loanwords without turning this into a linguistics degree.</p>
    <div class="hero-actions">
      <a class="button-link" href="${escapeHtml(getLearnIpaAppPath())}">Start learning</a>
      <a class="button-link subtle" href="${escapeHtml(LEARN_IPA_REFERENCE_PATH)}">Browse the symbol reference</a>
    </div>
    <div class="meta-row">
      <span>${curriculum.modules.length} modules</span>
      <span>${curriculum.steps.length} short steps</span>
      <span>${curriculum.symbols.length} symbols and marks</span>
      <span>${curriculum.reviewCards.length} review cards</span>
    </div>
  </section>
  <section class="panel">
    <div id="learn-ipa-app" data-curriculum-src="/learn-ipa/curriculum.json" data-storage-key="pronunciation-guide.learn-ipa">
      <p class="status-note">Loading the interactive course shell.</p>
    </div>
    <noscript>
      <p>This course is interactive and uses a small amount of JavaScript for progress, review scheduling, and audio controls. You can still explore the <a href="${escapeHtml(
        LEARN_IPA_REFERENCE_PATH
      )}">reference</a> and the module overviews without it.</p>
    </noscript>
  </section>
  <section class="panel split-panels">
    <div>
      <h2>What this teaches</h2>
      <ul class="gloss-list">
        <li>Broad English dictionary transcription, not ultra-narrow phonetics.</li>
        <li>Short practical lessons with examples, audio, and mixed review.</li>
        <li>High-value loanword and name patterns from German, French, Spanish, Chinese, and Japanese contexts.</li>
      </ul>
    </div>
    <div>
      <h2>Useful side doors</h2>
      <ul class="hub-list">
        <li><a href="${escapeHtml(LEARN_IPA_REFERENCE_PATH)}">Reference</a><span>symbol catalog</span></li>
        <li><a href="${escapeHtml(LEARN_IPA_ABOUT_PATH)}">About</a><span>scope and omissions</span></li>
        <li><a href="/browse/">Directory</a><span>jump back into word pages</span></li>
      </ul>
    </div>
  </section>
  <section class="panel">
    <h2>Course modules</h2>
    <p class="status-note">Each module stays short and practical. Start in order, or open an overview before you commit.</p>
    ${renderLearnIpaModuleCards(curriculum)}
  </section>
  <section class="panel">
    <h2>Why this lives inside the directory</h2>
    <p>The course is not a side project. It uses the same corpus, audio, and example types as the pronunciation directory, so the skills transfer directly into the real word pages you are already using.</p>
    ${renderLearnIpaQuickLinks()}
  </section>`;

  return renderLayout(config, {
    title: `Learn IPA | ${config.siteName}`,
    description:
      "Learn to read practical IPA through a short interactive course built from the pronunciation directory corpus.",
    pathname: "/learn-ipa/",
    scripts: ["/assets/client/learn-ipa/app.js"],
    main
  });
}
