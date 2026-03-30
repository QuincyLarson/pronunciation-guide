import { escapeHtml } from "../lib/html";
import { getLearnIpaAppPath, LEARN_IPA_ABOUT_PATH, LEARN_IPA_REFERENCE_PATH } from "../lib/learn-ipa/routes";
import type { SiteConfig } from "../lib/site-config";
import type { LearnCurriculum } from "../types/learn-ipa";
import { renderLayout } from "./layout";
import { renderLearnIpaModuleCards, renderLearnIpaQuickLinks } from "./learn-ipa-shared";

export function renderLearnIpaPage(curriculum: LearnCurriculum, config: SiteConfig, options?: { progressView?: boolean }): string {
  const main = `<section class="hero hero-home hero-learn">
    <p class="eyebrow">Interactive IPA course</p>
    <h1>Read practical IPA fast.</h1>
    <p class="hero-gloss">Short lessons, frequent review, and real examples from the pronunciation directory.</p>
    <div class="hero-actions">
      <a class="button-link" href="${escapeHtml(getLearnIpaAppPath())}">Start</a>
      <a class="button-link subtle" href="${escapeHtml(LEARN_IPA_REFERENCE_PATH)}">Reference</a>
    </div>
    <div class="meta-row">
      <span>${curriculum.modules.length} modules</span>
      <span>${curriculum.steps.length} short steps</span>
      <span>${curriculum.symbols.length} symbols and marks</span>
      <span>${curriculum.reviewCards.length} review cards</span>
    </div>
  </section>
  <section class="panel">
    <div id="learn-ipa-app" data-curriculum-src="/learn-ipa/curriculum.json" data-drill-src="/learn-ipa/drill-examples.json" data-storage-key="pronunciation-guide.learn-ipa" data-initial-view="${options?.progressView ? "progress" : "overview"}">
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
      <h2>What you get</h2>
      <ul class="gloss-list">
        <li>Core symbols first.</li>
        <li>Fast teach → practice → review loops.</li>
        <li>Deep drill sets backed by trusted pronunciation dictionaries.</li>
      </ul>
    </div>
    <div>
      <h2>Quick links</h2>
      ${renderLearnIpaQuickLinks()}
      <p class="status-note"><a href="${escapeHtml(LEARN_IPA_ABOUT_PATH)}">About the course</a></p>
    </div>
  </section>
  <section class="panel">
    <h2>Course modules</h2>
    <p class="status-note">Each module stays short and practical. Start in order, or open an overview before you commit.</p>
    ${renderLearnIpaModuleCards(curriculum)}
  </section>
`;

  return renderLayout(config, {
    title: `Learn IPA | ${config.siteName}`,
    description:
      "Learn to read practical IPA through a short interactive course built from the pronunciation directory corpus.",
    pathname: options?.progressView ? "/learn-ipa/progress/" : "/learn-ipa/",
    scripts: ["/assets/client/learn-ipa/app.js"],
    robots: options?.progressView ? "noindex,follow" : "index,follow",
    main
  });
}
