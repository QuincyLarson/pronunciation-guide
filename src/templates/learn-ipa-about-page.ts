import type { SiteConfig } from "../lib/site-config";
import type { LearnCurriculum } from "../types/learn-ipa";
import { renderLayout } from "./layout";

export function renderLearnIpaAboutPage(curriculum: LearnCurriculum, config: SiteConfig): string {
  const main = `<section class="hero">
    <p class="eyebrow">About Learn IPA</p>
    <h1>A practical reading course, not a maximalist phonetics encyclopedia.</h1>
    <p class="hero-gloss">The course teaches the subset of IPA that helps most on real pronunciation pages: broad English transcription, common stress marks, and the highest-value international sounds that show up in names and loanwords.</p>
  </section>
  <section class="panel split-panels">
    <div>
      <h2>What it covers</h2>
      <ul class="gloss-list">
        <li>${curriculum.modules.length} modules built from the site’s own corpus.</li>
        <li>${curriculum.steps.length} short steps with decoding, listening, and review.</li>
        <li>${curriculum.symbols.length} symbols and marks, including high-value non-English patterns.</li>
      </ul>
    </div>
    <div>
      <h2>What it does not try to do</h2>
      <ul class="gloss-list">
        <li>No thin SEO lesson pages for every tiny step.</li>
        <li>No accounts, leaderboards, or server-side progress state.</li>
        <li>No launch-blocking microphone grading.</li>
      </ul>
    </div>
  </section>
  <section class="panel">
    <h2>Why the course is generated from files</h2>
    <p>Symbols, examples, modules, and concepts live in versioned YAML and Markdown so contributors can improve the curriculum without touching a database. The build step validates the graph and produces a single curriculum artifact for the client app.</p>
  </section>`;

  return renderLayout(config, {
    title: `About Learn IPA | ${config.siteName}`,
    description:
      "Learn what the Learn IPA course covers, what it intentionally omits, and how it fits into the pronunciation directory.",
    pathname: "/learn-ipa/about/",
    main
  });
}
