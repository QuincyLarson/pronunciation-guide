import { escapeHtml } from "../lib/html";
import { getLearnIpaAppPath } from "../lib/learn-ipa/routes";
import type { LearnIpaWordLink } from "../lib/learn-ipa/lookup";
import { buildWordDescription, buildWordTitle } from "../lib/meta";
import { audioUrl, type SiteConfig } from "../lib/site-config";
import { getWordPath } from "../lib/shards";
import type { Entry, PronunciationVariant } from "../types/content";
import { renderLayout } from "./layout";

function renderVariant(variant: PronunciationVariant, entry: Entry, config: SiteConfig, index: number): string {
  const audioId = `audio-${entry.slug}-${variant.id}`;
  const audioSrc = audioUrl(config, variant.audio.src);
  const shouldAutoplay = index === 0;
  const speechText = variant.respelling ?? variant.audio.engineInput ?? entry.display;
  const prefersSpeechFallback =
    variant.audio.engine === "say" || variant.audio.src.startsWith("/audio/fixtures/");

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
      data-prefer-speech="${prefersSpeechFallback ? "true" : "false"}"
      data-speech-text="${escapeHtml(speechText)}"
      data-speech-locale="${escapeHtml(variant.locale)}"
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
    <h2>More word pages</h2>
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

function renderLearnLinks(links: LearnIpaWordLink[]): string {
  if (links.length === 0) {
    return "";
  }

  return `<section class="panel" data-learn-links>
    <h2>Study the symbols in this word</h2>
    <p class="status-note" data-learn-progress>Jump straight to the lesson steps that explain this IPA.</p>
    <div class="meta-row">
      ${links
        .map(
          (link) =>
            `<a class="learn-pill" href="${escapeHtml(link.href)}" data-learn-step-id="${escapeHtml(
              link.stepId
            )}"><span class="phonetic">${escapeHtml(link.symbol)}</span> · ${escapeHtml(link.name)}</a>`
        )
        .join("")}
    </div>
  </section>`;
}

function renderProvenanceList(entry: Entry): string {
  return `<ul class="provenance-list">
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
  </ul>`;
}

function renderWordContext(entry: Entry): string {
  const originParts = [
    entry.origin.sourceLanguageName ? `Origin: ${entry.origin.sourceLanguageName}` : "",
    entry.origin.etymologyLabel ?? ""
  ].filter(Boolean);

  return `<section class="panel split-panels">
    <div>
      <h2>Meaning</h2>
      <ul class="gloss-list compact-list">
        ${entry.glosses.map((gloss) => `<li>${escapeHtml(gloss)}</li>`).join("")}
      </ul>
    </div>
    <div>
      <h2>Quick context</h2>
      ${
        originParts.length > 0
          ? `<p>${escapeHtml(originParts.join(" · "))}</p>`
          : `<p class="status-note">This page is here mainly to support IPA practice and quick playback.</p>`
      }
    </div>
  </section>`;
}

function renderWordDetails(entry: Entry, contributionUrl: string): string {
  if (entry.confusionNotes.length === 0 && !entry.bodyHtml && entry.provenance.length === 0) {
    return "";
  }

  return `<details class="panel panel-detail">
    <summary>Notes and sources</summary>
    <div class="details-stack">
      ${
        entry.confusionNotes.length > 0
          ? `<section><h3>Common confusion</h3><p>${escapeHtml(entry.confusionNotes.join(" "))}</p></section>`
          : ""
      }
      ${entry.bodyHtml ? `<section class="prose"><h3>Notes</h3>${entry.bodyHtml}</section>` : ""}
      ${
        entry.provenance.length > 0
          ? `<section><h3>Sources</h3>${renderProvenanceList(entry)}</section>`
          : ""
      }
      <section>
        <h3>Improve this page</h3>
        <p><a href="${escapeHtml(contributionUrl)}">Suggest an audio, source, or wording improvement on GitHub</a></p>
      </section>
    </div>
  </details>`;
}

export function renderWordPage(entry: Entry, config: SiteConfig, learnLinks: LearnIpaWordLink[] = []): string {
  const title = buildWordTitle(entry, config.siteTitleSuffix);
  const description = buildWordDescription(entry);
  const leadVariant = entry.variants[0] ?? null;
  const leadIpa = leadVariant?.ipa ? leadVariant.ipa.replace(/^\/|\/$/g, "") : null;
  const firstLearnLink = learnLinks[0] ?? null;
  const contributionUrl = `${config.repoUrl}/issues/new?title=${encodeURIComponent(
    `Pronunciation correction: ${entry.display}`
  )}`;
  const candidateReasons = entry.indexStatus.reasons.slice(0, 2).join("; ");
  const main = `<article class="word-page">
    <section class="hero hero-word">
      <p class="eyebrow">Word page</p>
      <h1>${escapeHtml(entry.display)}</h1>
      <p class="hero-gloss">${escapeHtml(entry.shortGloss ?? entry.glosses[0] ?? "Pronunciation guide")}</p>
      <div class="hero-actions">
        ${
          firstLearnLink
            ? `<a class="button-link" href="${escapeHtml(firstLearnLink.href)}">Open matching lesson</a>`
            : `<a class="button-link" href="${escapeHtml(getLearnIpaAppPath())}">Open curriculum</a>`
        }
        <a class="button-link subtle" href="/browse/">More word pages</a>
      </div>
      <div class="meta-row">
        ${leadIpa ? `<span class="word-ipa-chip">/${escapeHtml(leadIpa)}/</span>` : ""}
        ${leadVariant ? `<span>${escapeHtml(leadVariant.label)}</span>` : ""}
        ${entry.pos.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}
        ${entry.topics.map((topic) => `<span>${escapeHtml(topic)}</span>`).join("")}
      </div>
      ${
        entry.indexStatus.mode === "noindex"
          ? `<p class="status-note">This page stays available but is marked noindex while it needs more editorial support.${candidateReasons ? ` Current blockers: ${escapeHtml(candidateReasons)}.` : ""}</p>`
          : ""
      }
    </section>
    ${renderLearnLinks(learnLinks)}
    <section class="panel">
      <h2>Pronunciation variants</h2>
      <div class="variant-stack">
        ${entry.variants.map((variant, index) => renderVariant(variant, entry, config, index)).join("")}
      </div>
    </section>
    ${renderWordContext(entry)}
    ${renderRelated(entry)}
    ${renderWordDetails(entry, contributionUrl)}
  </article>`;

  return renderLayout(config, {
    title,
    description,
    pathname: getWordPath(entry.slug),
    robots: entry.indexStatus.mode === "index" ? "index,follow" : "noindex,follow",
    scripts: [
      "/assets/client/audio-controls.js",
      ...(learnLinks.length > 0 ? ["/assets/client/learn-ipa/word-links.js"] : [])
    ],
    main
  });
}
