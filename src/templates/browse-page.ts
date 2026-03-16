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
    <p class="eyebrow">Browse the directory</p>
    <h1>Browse all ${entries.length} pronunciation pages.</h1>
    <p class="hero-gloss">The homepage stays intentionally small. This index exposes the full corpus so you can jump straight to any generated or curated entry.</p>
    <div class="hero-actions">
      <a class="button-link" href="/topics/">Browse topic hubs</a>
      <a class="button-link subtle" href="/origins/">Browse origin hubs</a>
    </div>
  </section>
  <section class="panel browse-sections">
    ${groups
      .map(
        (group) => `<section class="browse-group">
          <h2>${escapeHtml(group.letter)}</h2>
          <ul class="entry-grid">
            ${group.entries
              .map(
                (entry) =>
                  `<li><a href="${escapeHtml(getWordPath(entry.slug))}">${escapeHtml(entry.display)}</a><p>${escapeHtml(
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
