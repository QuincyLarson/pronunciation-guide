import { escapeHtml } from "../lib/html";
import { buildWordDescription, buildWordTitle } from "../lib/meta";
import { audioUrl, type SiteConfig } from "../lib/site-config";
import { getWordPath } from "../lib/shards";
import type { Entry, PronunciationVariant } from "../types/content";
import { renderLayout } from "./layout";

function renderVariant(variant: PronunciationVariant, entry: Entry, config: SiteConfig, index: number): string {
  const audioId = `audio-${entry.slug}-${variant.id}`;
  const audioSrc = audioUrl(config, variant.audio.src);
  const shouldAutoplay = index === 0;

  return `<article class="variant-card">
    <header class="variant-header">
      <div>
        <h2>${escapeHtml(variant.label)}</h2>
        <p class="variant-locale">${escapeHtml(variant.locale)}</p>
      </div>
      <p class="variant-kind">${escapeHtml(variant.audio.kind)} audio</p>
    </header>
    <dl class="variant-grid">
      <div>
        <dt>IPA</dt>
        <dd>${variant.ipa ? `<span class="phonetic">${escapeHtml(variant.ipa)}</span>` : "Pending"}</dd>
      </div>
      <div>
        <dt>Respelling</dt>
        <dd>${variant.respelling ? escapeHtml(variant.respelling) : "Pending"}</dd>
      </div>
      <div>
        <dt>Review</dt>
        <dd>${escapeHtml(variant.audio.reviewStatus)}</dd>
      </div>
      <div>
        <dt>License</dt>
        <dd>${variant.audio.license ? escapeHtml(variant.audio.license) : "See source metadata"}</dd>
      </div>
    </dl>
    ${
      variant.notes.length > 0
        ? `<p class="variant-notes">${escapeHtml(variant.notes.join(" "))}</p>`
        : ""
    }
    <div class="audio-row">
      <button type="button" data-audio-target="${escapeHtml(audioId)}" data-playback-rate="1">
        Replay 1x
      </button>
      <button type="button" data-audio-target="${escapeHtml(audioId)}" data-playback-rate="0.5">
        Replay 0.5x
      </button>
      <span class="confidence">Confidence ${Math.round(variant.audio.confidence * 100)}%</span>
    </div>
    <audio
      id="${escapeHtml(audioId)}"
      preload="${shouldAutoplay ? "auto" : "none"}"
      src="${escapeHtml(audioSrc)}"
      data-autoplay="${shouldAutoplay ? "true" : "false"}"
      ${shouldAutoplay ? "autoplay" : ""}
      playsinline
    ></audio>
  </article>`;
}

function renderRelated(entry: Entry): string {
  if (entry.related.length === 0) {
    return "";
  }

  return `<section class="panel">
    <h2>Related terms</h2>
    <ul class="link-list">
      ${entry.related
        .map(
          (link) =>
            `<li><a href="${escapeHtml(getWordPath(link.slug))}">${escapeHtml(link.label)}</a><span>${escapeHtml(link.reason)}</span></li>`
        )
        .join("")}
    </ul>
  </section>`;
}

function renderOrigin(entry: Entry): string {
  if (!entry.origin.sourceLanguageName && !entry.origin.etymologyLabel) {
    return "";
  }

  const parts = [
    entry.origin.sourceLanguageName ? `Origin: ${entry.origin.sourceLanguageName}` : "",
    entry.origin.etymologyLabel ?? ""
  ].filter(Boolean);

  return `<section class="panel">
    <h2>Origin</h2>
    <p>${escapeHtml(parts.join(" · "))}</p>
  </section>`;
}

function renderProvenance(entry: Entry): string {
  return `<section class="panel">
    <h2>Provenance</h2>
    <ul class="provenance-list">
      ${entry.provenance
        .map(
          (source) =>
            `<li>
              <a href="${escapeHtml(source.sourceUrl)}">${escapeHtml(source.sourceName)}</a>
              <span>${escapeHtml(source.sourceLicense)}</span>
              <span>${escapeHtml(source.reviewStatus)}</span>
            </li>`
        )
        .join("")}
    </ul>
  </section>`;
}

export function renderWordPage(entry: Entry, config: SiteConfig): string {
  const title = buildWordTitle(entry, config.siteTitleSuffix);
  const description = buildWordDescription(entry);
  const contributionUrl = `${config.repoUrl}/issues/new?title=${encodeURIComponent(
    `Pronunciation correction: ${entry.display}`
  )}`;
  const main = `<article class="word-page">
    <section class="hero">
      <p class="eyebrow">Pronunciation directory</p>
      <h1>${escapeHtml(entry.display)}</h1>
      <p class="hero-gloss">${escapeHtml(entry.shortGloss ?? entry.glosses[0] ?? "Pronunciation guide")}</p>
      <div class="meta-row">
        ${entry.pos.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}
        ${entry.topics.map((topic) => `<span>${escapeHtml(topic)}</span>`).join("")}
      </div>
      ${
        entry.indexStatus.mode === "noindex"
          ? `<p class="status-note">This page stays available but is marked noindex while it needs more editorial support.</p>`
          : ""
      }
    </section>
    <section class="panel">
      <h2>Pronunciation variants</h2>
      <div class="variant-stack">
        ${entry.variants.map((variant, index) => renderVariant(variant, entry, config, index)).join("")}
      </div>
    </section>
    <section class="panel">
      <h2>Gloss</h2>
      <ul class="gloss-list">
        ${entry.glosses.map((gloss) => `<li>${escapeHtml(gloss)}</li>`).join("")}
      </ul>
    </section>
    ${renderRelated(entry)}
    ${renderOrigin(entry)}
    ${
      entry.confusionNotes.length > 0
        ? `<section class="panel"><h2>Common confusion</h2><p>${escapeHtml(entry.confusionNotes.join(" "))}</p></section>`
        : ""
    }
    ${entry.bodyHtml ? `<section class="panel prose"><h2>Notes</h2>${entry.bodyHtml}</section>` : ""}
    ${renderProvenance(entry)}
    <section class="panel">
      <h2>Contribute</h2>
      <p><a href="${escapeHtml(contributionUrl)}">Suggest an audio, source, or wording improvement on GitHub</a></p>
    </section>
  </article>`;

  return renderLayout(config, {
    title,
    description,
    pathname: getWordPath(entry.slug),
    robots: entry.indexStatus.mode === "index" ? "index,follow" : "noindex,follow",
    includeAudioScript: true,
    main
  });
}
