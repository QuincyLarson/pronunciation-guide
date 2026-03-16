import { escapeHtml } from "../lib/html";
import type { SiteConfig } from "../lib/site-config";
import { renderLayout } from "./layout";

export interface AttributionGroup {
  sourceName: string;
  sourceUrl: string;
  sourceLicense: string;
  attributionText: string;
  entryCount: number;
  entrySlugs: string[];
  fields: string[];
  audioVariantCount: number;
}

export function renderAttributionPage(
  groups: AttributionGroup[],
  manifestPath: string,
  licenseManifestPath: string,
  config: SiteConfig
): string {
  const main = `<section class="hero">
    <p class="eyebrow">Licenses and provenance</p>
    <h1>Attribution</h1>
    <p class="hero-gloss">Imported data and audio stay separated from application code, with grouped source and license details for each build.</p>
  </section>
  <section class="panel">
    <p><a href="${escapeHtml(manifestPath)}">Download the machine-readable attribution manifest</a></p>
    <p><a href="${escapeHtml(licenseManifestPath)}">Download the machine-readable license manifest</a></p>
    <ul class="attribution-list">
      ${groups
        .map(
          (group) =>
            `<li>
              <h2><a href="${escapeHtml(group.sourceUrl)}">${escapeHtml(group.sourceName)}</a></h2>
              <p>${escapeHtml(group.sourceLicense)}</p>
              <p>${escapeHtml(group.attributionText)}</p>
              <p>${group.entryCount} entries</p>
              <p>${group.audioVariantCount} linked audio variants</p>
              <p>Fields: ${escapeHtml(group.fields.slice(0, 8).join(", "))}${group.fields.length > 8 ? " ..." : ""}</p>
              <p>${escapeHtml(group.entrySlugs.slice(0, 8).join(", "))}${group.entrySlugs.length > 8 ? " ..." : ""}</p>
            </li>`
        )
        .join("")}
    </ul>
  </section>`;

  return renderLayout(config, {
    title: `Attribution | ${config.siteTitleSuffix}`,
    description: "Licensing and attribution details for imported pronunciation data and audio.",
    pathname: "/attribution/",
    main
  });
}
