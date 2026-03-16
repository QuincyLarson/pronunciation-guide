import { escapeHtml } from "../lib/html";
import { getWordPath } from "../lib/shards";
import type { Entry } from "../types/content";
import type { SiteConfig } from "../lib/site-config";
import { renderLayout } from "./layout";

export function renderHomePage(
  featuredEntries: Entry[],
  origins: Array<{ slug: string; count: number }>,
  topics: Array<{ slug: string; count: number }>,
  totalEntries: number,
  config: SiteConfig
): string {
  const main = `<section class="hero hero-home">
    <p class="eyebrow">Ultra-fast pronunciation directory</p>
    <h1>Hear difficult words before you say them out loud.</h1>
    <p class="hero-gloss">${escapeHtml(config.siteDescription)}</p>
    <div class="hero-actions">
      <a class="button-link" href="/browse/">Browse all ${totalEntries} pages</a>
      <a class="button-link subtle" href="/topics/">Browse topic hubs</a>
      <a class="button-link" href="/origins/">Browse origin hubs</a>
    </div>
  </section>
  <section class="panel">
    <h2>Featured pages</h2>
    <ul class="entry-grid">
      ${featuredEntries
        .map(
          (entry) =>
            `<li><a href="${escapeHtml(getWordPath(entry.slug))}">${escapeHtml(entry.display)}</a><p>${escapeHtml(
              entry.shortGloss ?? entry.glosses[0] ?? ""
            )}</p></li>`
        )
        .join("")}
    </ul>
  </section>
  <section class="panel split-panels">
    <div>
      <h2>Origins</h2>
      <ul class="hub-list">
        ${origins
          .map(
            (origin) =>
              `<li><a href="/origins/${escapeHtml(origin.slug)}/">${escapeHtml(origin.slug)}</a><span>${origin.count} pages</span></li>`
          )
          .join("")}
      </ul>
    </div>
    <div>
      <h2>Topics</h2>
      <ul class="hub-list">
        ${topics
          .map(
            (topic) =>
              `<li><a href="/topics/${escapeHtml(topic.slug)}/">${escapeHtml(topic.slug)}</a><span>${topic.count} pages</span></li>`
          )
          .join("")}
      </ul>
    </div>
  </section>`;

  return renderLayout(config, {
    title: `${config.siteName} | ${config.siteTagline}`,
    description: config.siteDescription,
    pathname: "/",
    main
  });
}
