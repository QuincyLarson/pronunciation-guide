import { escapeHtml } from "../lib/html";
import { getWordPath } from "../lib/shards";
import type { Entry } from "../types/content";
import type { SiteConfig } from "../lib/site-config";
import { renderLayout } from "./layout";

interface HubPageOptions {
  robots?: string;
  totalEntries?: number;
  indexableEntries?: number;
}

export function renderHubPage(
  title: string,
  description: string,
  intro: string,
  pathname: string,
  entries: Entry[],
  config: SiteConfig,
  options: HubPageOptions = {}
): string {
  const summary =
    typeof options.totalEntries === "number" && typeof options.indexableEntries === "number"
      ? `<p class="status-note">${options.indexableEntries} indexable pages from ${options.totalEntries} total entries.</p>`
      : "";
  const main = `<section class="hero">
    <p class="eyebrow">Hub page</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="hero-gloss">${escapeHtml(intro)}</p>
    ${summary}
  </section>
  <section class="panel">
    <h2>Featured entries</h2>
    <ul class="entry-grid">
      ${entries
        .map(
          (entry) =>
            `<li><a href="${escapeHtml(getWordPath(entry.slug))}">${escapeHtml(entry.display)}</a><p>${escapeHtml(
              entry.shortGloss ?? entry.glosses[0] ?? ""
            )}</p></li>`
        )
        .join("")}
    </ul>
  </section>`;

  return renderLayout(config, {
    title: `${title} | ${config.siteTitleSuffix}`,
    description,
    pathname,
    robots: options.robots,
    main
  });
}
