import type { SiteConfig } from "../lib/site-config";
import type { LearnCurriculum } from "../types/learn-ipa";
import { renderLayout } from "./layout";

export function renderLearnIpaAboutPage(curriculum: LearnCurriculum, config: SiteConfig): string {
  const main = `<section class="hero hero-learn">
    <p class="eyebrow">About Learn IPA</p>
    <h1>A practical reading course, not a phonetics encyclopedia.</h1>
    <p class="hero-gloss">Learn the symbols that pay off most on real pronunciation pages, then reinforce them through drills and review.</p>
  </section>
  <section class="panel split-panels">
    <div>
      <h2>What you get</h2>
      <ul class="gloss-list compact-list">
        <li>${curriculum.modules.length} modules built from the site’s own corpus.</li>
        <li>${curriculum.steps.length} short steps with decoding, listening, and review.</li>
        <li>${curriculum.symbols.length} symbols and marks, including high-value non-English patterns.</li>
      </ul>
    </div>
    <div>
      <h2>What stays out of the way</h2>
      <ul class="gloss-list compact-list">
        <li>No accounts, leaderboards, or server-side progress state.</li>
        <li>No launch-blocking microphone grading.</li>
        <li>No giant glossary dump before you start practicing.</li>
      </ul>
    </div>
  </section>
  <section class="panel">
    <h2>Why it is generated from files</h2>
    <p>Symbols, examples, modules, and concepts live in versioned YAML and Markdown so the curriculum can grow without adding a backend. The build validates the graph and ships a single course artifact to the client.</p>
  </section>`;

  return renderLayout(config, {
    title: `About Learn IPA | ${config.siteName}`,
    description:
      "Learn what the Learn IPA course covers, what it intentionally omits, and how it fits into the pronunciation directory.",
    pathname: "/learn-ipa/about/",
    main
  });
}
