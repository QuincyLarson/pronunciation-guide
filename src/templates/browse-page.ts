import { escapeHtml } from "../lib/html";
import { getWordPath } from "../lib/shards";
import type { Entry } from "../types/content";
import type { SiteConfig } from "../lib/site-config";
import { renderLayout } from "./layout";

function groupEntries(entries: Entry[]): Array<{ letter: string; entries: Entry[] }> {
  const groups = new Map<string, Entry[]>();

  for (const entry of [...entries].sort((left, right) => left.display.localeCompare(right.display))) {
    const letter = entry.display.slice(0, 1).toUpperCase() || "#";
    const key = /[A-Z]/.test(letter) ? letter : "#";
    const current = groups.get(key) ?? [];
    current.push(entry);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([letter, groupedEntries]) => ({ letter, entries: groupedEntries }));
}

export function renderBrowsePage(entries: Entry[], config: SiteConfig): string {
  const groups = groupEntries(entries);
  const main = `<section class="hero hero-home">
    <p class="eyebrow">Word pages</p>
    <h1>Browse all ${entries.length} pronunciation pages.</h1>
    <p class="hero-gloss">Use these as real IPA practice after the curriculum introduces the symbols.</p>
    <div class="hero-actions">
      <a class="button-link" href="/learn-ipa/">Open curriculum</a>
      <a class="button-link subtle" href="/learn-ipa/reference/">Reference</a>
    </div>
    <form class="search-form" data-site-search-form role="search" aria-label="Search pronunciation entries">
      <label class="sr-only" for="browse-word-search">Search words</label>
      <input id="browse-word-search" type="search" name="q" data-browse-search placeholder="Filter this page or jump to a word">
      <button type="submit" class="button-link">Open word page</button>
    </form>
  </section>
  <section class="panel browse-sections">
    ${groups
      .map(
        (group) => `<section class="browse-group" data-browse-group>
          <h2>${escapeHtml(group.letter)}</h2>
          <ul class="entry-grid">
            ${group.entries
              .map(
                (entry) =>
                  `<li data-browse-entry data-search-text="${escapeHtml(`${entry.display} ${entry.shortGloss ?? entry.glosses[0] ?? ""}`)}"><a href="${escapeHtml(getWordPath(entry.slug))}">${escapeHtml(entry.display)}</a><p>${escapeHtml(
                    entry.shortGloss ?? entry.glosses[0] ?? ""
                  )}</p></li>`
              )
              .join("")}
          </ul>
        </section>`
      )
      .join("")}
  </section>`;

  return renderLayout(config, {
    title: `Browse | ${config.siteName}`,
    description: `Browse all ${entries.length} pronunciation pages in ${config.siteName}.`,
    pathname: "/browse/",
    main
  });
}
