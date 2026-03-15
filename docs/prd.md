# PRD: Pronunciation Guide

## Working title
Hard Words — an open, ultra-fast pronunciation directory for difficult words, loanwords, names, and uncommon terms.

## Product thesis
General dictionaries and Google answer many head-word pronunciation queries already. The opportunity is the messy long tail: names, loanwords, academic terms, medicine and brand names, news names, foreign terms used in English, and words that do not reliably trigger a high-quality pronunciation answer in search.

The product should win on four things:
1. Instant page load.
2. Instant audio upon loading. Single click to listen again at 1x or .5x speed.
3. Clear variant labeling (US, UK, native/local, newsroom, etc.).
4. Better page value than a thin "word + IPA + button" page: definition, origin, common mistakes, and trustworthy source/provenance, recommended similar terms people can practice

## Objectives
- Build a deployable Cloudflare-based site with no relational database.
- Keep runtime lightweight enough for a zero-budget or near-zero-budget launch.
- Support a very large corpus, but avoid treating every entry as an index-worthy page on day one.
- Make contributions easy for open-source collaborators.
- Preserve licensing and attribution for reused data.

## Non-goals
- Building a full dictionary competitor with exhaustive examples, etymology essays, and language-learning lessons.
- Solving every language perfectly in v1.
- Live user accounts, comments, forums, or community moderation at launch.
- In-browser speech synthesis as the primary playback path.

## Primary users
1. Search visitors who want to hear one hard word or name.
2. Speakers/writers who are about to say a word publicly and do not want to get it wrong.
3. Learners and teachers who want audio plus IPA plus a plain-English respelling.
4. Contributors who want to improve pronunciations for words from their language.

## Core jobs to be done
- “I saw this word and want to hear it pronounced immediately.”
- “I need the American English version, British version, and possibly native/local version. (The word “Qatar” pronunced Al Jazeera VS CNN style)
- “I want to know how this word is usually said in English, even if a native pronunciation also exists.”
- “I want a few nearby words I should learn too.”

## Product principles
- Audio first.
- Text second.
- IPA available, but never the only aid.
- Provenance visible.
- Variants explicit.
- Minimal HTML, minimal JS, minimal CSS.
- Static-first, edge-rendered when needed.
- Separate content coverage from SEO indexation.

## Recommended launch strategy
### Phase 1 indexable corpus
Launch with 20,000 high-value pages that meet a minimum usefulness standard:
- At least one playable audio variant.
- At least one definition or gloss.
- At least one clear pronunciation notation (IPA and/or plain-English respelling).
- Source attribution.
- At least 2 genuinely useful internal links.
- No unresolved confidence or licensing flags.

### Phase 1 total coverage corpus
Support a much larger lookup corpus behind the same URL structure, but do not force every entry into XML sitemaps at launch. Keep long-tail pages available on demand and graduate them into sitemaps only after they prove useful through Search Console or editorial judgment.

### Suggested launch slices
- Proper nouns and news names.
- English loanwords from German.
- English loanwords from French.
- English loanwords from Chinese.
- Common academic terms.
- Brand names.
- Common medical terminology.
- Frequently mispronounced words.

## Why not one million static pages at launch?
- It creates a quality-control problem.
- It creates a licensing/provenance problem.
- It creates a crawl/indexation problem.
- It creates a Cloudflare file-count problem if implemented naively.
- It creates a Git/repo hygiene problem if every entry is a checked-in standalone source file.

## Functional requirements
### Word page
Each canonical page must support:
- Canonical URL: `/word/<slug>`.
- Title tag and meta description.
- H1 word or name.
- Part of speech when known.
- Short gloss/definition.
- One or more pronunciation variants.
- For each variant:
  - label (for example: General American, British English, Native/Local, Newsroom, Mandarin Pinyin, etc.)
  - locale or language tag
  - IPA
  - plain-English respelling when possible with emphasis syllable capitalized e.g. kul-OSS-ul
  - audio source
  - replay controls at 1x and 0.5x
  - optional usage note
- Origin language or etymology bucket when known.
- Related links section (“Similar words you should know”).
- Common confusion or common mispronunciation note when available.
- Provenance block showing source(s), licenses, and last review status.
- Suggested contribution link to GitHub.

### Hub pages
Launch hub pages for:
- `/origins/`
- `/origins/german/`
- `/origins/chinese/`
- `/topics/news-names/`
- `/topics/academic/`
- `/topics/brands/`
- `/topics/medicine/`
- `/topics/places/`

Hub pages are important for both users and SEO. They should not be tag dumps; they should contain light editorial curation and link clusters.

### Similar words / internal linking
Each page should link to 3–6 related pages, chosen from these ranked buckets:
1. Same confusion cluster (words/names users often get wrong together).
2. Same origin language and similar English-use context.
3. Same semantic neighborhood (WordNet / related terms).
4. Same transliteration family or alternative spelling family.
5. Same topic bucket (politics, linguistics, medicine, etc.).

Never render giant keyword clouds. Links must be visibly helpful.

### Search and navigation
V1 can ship without site search if necessary. If included, make it purely client-side on a very small prebuilt search index for top pages only, or a Worker endpoint that looks up slugs in precomputed shards.

## Performance requirements
- First response should be edge-fast and cacheable.
- HTML should be tiny.
- No framework hydration on word pages.
- No ad scripts.
- Custom CSS under a few KB if practical.
- JavaScript only for audio buttons and tiny progressive enhancement.
- Audio playback should begin immediately after a user click.
- Autoplay may be attempted, but failures must gracefully fall back to a visible play button.

## SEO and indexing policy
### Hard rule
Do not publish or sitemap pages that are only “word + raw IPA + machine audio” unless they also have enough useful context to satisfy a user.

### Indexation criteria
A page is eligible for sitemap inclusion only if:
- it has a stable canonical URL,
- it has at least one trustworthy pronunciation entry,
- it has a gloss or definition,
- it has provenance,
- it has at least 2 useful internal links,
- it is not a near-duplicate of another page,
- it is not flagged for licensing uncertainty,
- it is not flagged as low-confidence audio.

### Noindex rules
Apply `noindex,follow` to:
- placeholder pages,
- pages with unresolved provenance,
- pages with only synthetic audio and no meaningful descriptive content,
- auto-generated near-duplicates,
- temporary QA pages.

### Sitemap strategy
Generate:
- `sitemap.xml` as index
- `sitemaps/core.xml`
- `sitemaps/origins-*.xml`
- `sitemaps/topics-*.xml`
- `sitemaps/expanded-*.xml`

Start with a curated set. Expand only when page quality and demand justify it.

## Data strategy

## Canonical data model
Use two layers.

### Layer A: generated base corpus (machine-generated, not hand-edited per entry)
Stored as sharded JSON/JSONL during build, not as a million committed markdown files.

### Layer B: human override corpus (hand-edited)
Stored as markdown files in Git for corrections, additions, and curated notes.

This allows open-source contributions without forcing the repository to store one markdown file for every single generated entry.

## Why not one markdown file per word as the primary source?
For a very large corpus, one-file-per-word becomes operationally awkward in Git and deployment workflows. The preferred compromise is:
- generated base data in shards,
- markdown override files only where humans need to review or improve an entry,
- optional exported markdown snapshots for subsets if desired.

## Source precedence
Recommended precedence for each field:
1. Human-reviewed override markdown.
2. Open licensed human audio from Wikimedia / Wiktionary-derived sources.
3. Structured Wiktionary-derived extraction (Kaikki / Wiktextract).
4. CMUdict for US English pronunciations.
5. Open-dict-data / ipa-dict for supplemental IPA coverage.
6. WordNet / Open Multilingual WordNet for glosses and semantic relations.
7. Synthetic audio fallback.

## Recommended source set
### Primary pronunciation and lexical data
- Kaikki/Wiktextract extracts from Wiktionary for pronunciations, audio links, glosses, related terms, etymology/origin cues, and other structured lexical fields.
- CMUdict for English baseline pronunciations.
- open-dict-data/ipa-dict for additional IPA lists across languages and dialects.
- WikiPron / WikiPronunciationDict as pronunciation-oriented support datasets.

### Definitions and semantic relations
- Princeton WordNet / Open English WordNet for English glosses and semantic relations.
- Open Multilingual Wordnet where multilingual relation support is useful.

### Ranking and coverage selection
- wordfreq for initial candidate ranking.
- Google Search Console later for real impressions/clicks and expansion priorities.

### Loanword discovery
Seed origin collections by intersecting:
- Wiktionary etymology categories such as English terms borrowed from German and English terms borrowed from Chinese,
- with frequency/ranking data,
- then manually review the highest-value items.

## Licensing and provenance requirements
Every entry must preserve provenance for each imported field. Store at minimum:
- `source_name`
- `source_url`
- `source_license`
- `source_revision_or_dump_date`
- `attribution_text`
- `confidence`
- `review_status`

### Important licensing rule
Treat content derived from Wiktionary as content that carries attribution and share-alike obligations. Keep application code and content/data licensing separate.

### Repository licensing recommendation
- Application code: MIT or Apache-2.0.
- Content/data: per-source licensing with explicit notices.
- Generate an `/attribution` page and machine-readable attribution manifest at build time.

## Content schema
### Base entry schema (generated JSON)
```json
{
  "id": "en:sprachbund",
  "slug": "sprachbund",
  "display": "sprachbund",
  "language": "en",
  "pos": ["noun"],
  "glosses": [
    "A group of languages in a geographic area that have developed shared features through contact."
  ],
  "origin": {
    "source_language": "de",
    "source_language_name": "German",
    "etymology_label": "Borrowed from German"
  },
  "variants": [
    {
      "id": "en-US-default",
      "label": "General American",
      "lang": "en-US",
      "ipa": "/ˈʃprɑːxbʊnt/",
      "respelling": "SHPRAHKH-boont",
      "audio": {
        "kind": "synthetic",
        "src": "/audio/en/sprachbund/en-US-default.mp3",
        "engine": "espeak-ng",
        "engine_input": "...",
        "review_status": "unreviewed"
      },
      "notes": []
    },
    {
      "id": "de-native",
      "label": "German",
      "lang": "de",
      "ipa": "...",
      "respelling": null,
      "audio": {
        "kind": "human",
        "src": "...",
        "source": "Wikimedia Commons",
        "review_status": "reviewed"
      },
      "notes": []
    }
  ],
  "related": [
    "dialect continuum",
    "areal feature",
    "umlaut",
    "schadenfreude"
  ],
  "confusions": [],
  "topics": ["linguistics", "loanwords"],
  "search_rank": 0,
  "index_status": "candidate",
  "quality_score": 0,
  "sources": [
    {
      "name": "Kaikki/Wiktextract",
      "url": "...",
      "license": "CC-BY-SA-4.0 + GFDL",
      "dump_date": "2026-03-03"
    }
  ]
}
```

### Override markdown schema
```md
---
word: sprachbund
slug: sprachbund
language: en
origin_language: de
origin_label: Borrowed from German
pos:
  - noun
glosses:
  - A linguistic area whose languages share features through long contact.
variants:
  - id: en-US-default
    label: General American
    lang: en-US
    ipa: /ˈʃprɑːxbʊnt/
    respelling: SHPRAHKH-boont
    audio_mode: synthetic
    engine_input: ...
    review_status: reviewed
  - id: de-native
    label: German
    lang: de
    ipa: ...
    audio_mode: human
    audio_src: ...
    review_status: reviewed
related:
  - dialect continuum
  - areal feature
  - schadenfreude
notes:
  - Used in linguistics.
license_notes:
  - Derived gloss adapted from Wiktionary.
reviewers:
  - github-handle
---
Optional long-form notes for nuanced cases.
```

## Data pipeline
### Ingest pipeline
1. Download source snapshots.
2. Normalize each source into a common intermediate schema.
3. Deduplicate by language + normalized form + sense/variant where needed.
4. Merge fields by precedence.
5. Attach provenance at field level.
6. Compute quality score.
7. Compute index eligibility.
8. Assign shard path.
9. Generate audio jobs.
10. Build sitemaps, attribution manifests, and rendered assets.

### Quality scoring
Score pages higher when they have:
- human audio,
- multiple pronunciation variants with clear labels,
- reviewed override,
- strong gloss,
- internal link candidates,
- clear origin metadata,
- low duplication risk.

### Sharding strategy
Do not store all generated entries as individual deployable HTML files.
Instead:
- shard base content by language and slug prefix, e.g. `data/en/sp/spraak.json` or `data/en/sp.json`.
- keep shard size small enough for fast Worker reads.
- keep static asset count well below platform file-count ceilings.

## Runtime architecture
## Recommended architecture: hybrid static + Worker SSR + R2

### Why this architecture
- It preserves a “no database” runtime.
- It avoids shipping hundreds of thousands of static HTML files.
- It avoids bundling giant datasets into the Worker.
- It allows top pages to be pre-rendered while the tail is edge-rendered.

### Components
1. **Cloudflare Worker**
   - Handles routing.
   - Renders HTML for dynamic word pages.
   - Serves robots, sitemap index, and other lightweight dynamic endpoints if needed.

2. **Workers Static Assets**
   - Home page, hub pages, CSS, tiny JS, favicon, pre-rendered top pages.
   - Also optionally stores some small shard files if convenient.

3. **R2**
   - Stores audio files.
   - Stores larger JSON shards if they do not fit asset-count strategy.
   - Stores attribution manifests and optional corpus snapshots.

4. **Build scripts**
   - Node/TypeScript scripts generate shards, prerendered pages, sitemaps, and audio jobs.

### Runtime rules
- Requests for high-value pre-rendered pages should resolve to static assets whenever possible.
- Requests for tail entries should hit the Worker and fetch one small shard.
- Audio and immutable data should be long-cacheable.
- Worker bundle must remain tiny.

## Do not use as primary storage at launch
- KV as the main content store for the large corpus.
- D1 as the main content store.
- A heavy full-stack framework with hydration on every page.

KV is useful for tiny lookup maps, not for the whole corpus on a free hobby deployment.

## Technical stack recommendation
### Lightest practical stack
- TypeScript
- Cloudflare Workers
- Wrangler
- R2
- Vanilla HTML templates (string templates or tiny server-side view helpers)
- Tiny client-side JS for audio controls only
- Zod for schema validation
- Vitest for unit tests
- Node-based build scripts

### Optional developer-experience additions
- `@cloudflare/vite-plugin` for local dev and build ergonomics.
- Astro only for curated editorial pages or if contributor experience strongly favors markdown collections.
- Eleventy only if the project decides it wants a classic static-site workflow for hubs/docs, not for the whole corpus.

### Recommendation
For the word pages themselves, prefer a plain Worker + template functions. That is the lightest and most practical approach.

## Audio strategy
### Playback
Use a normal HTML `<audio>` element plus tiny custom buttons:
- Replay 1x
- Replay 0.5x

### Generation strategy
Use a layered approach:
1. Prefer open licensed human audio where available.
2. Use synthetic audio fallback for broad coverage.
3. Allow engine-specific phoneme overrides for difficult words.
4. Allow manual audio replacement for high-value pages.

### Important design choice
Do not assume that raw IPA can be fed directly to every open-source speech engine without transformation. The data model must support an optional engine-specific phoneme field or manual audio override.

### Synthetic engine recommendation
Start with eSpeak NG for build-time generation because it is compact and open source. Store generated outputs as compressed audio files in object storage.

### Review flags
For every audio variant, track:
- `human` vs `synthetic`
- `reviewed` vs `unreviewed`
- `confidence`
- `source engine`

## URL design
- `/` home
- `/w/<slug>` canonical page
- `/origins/`
- `/origins/<origin-language>/`
- `/topics/<topic>/`
- `/languages/<lang>/` if multilingual browsing is later exposed
- `/attribution/`
- `/sitemaps/...`
- `/api/lookup/<slug>` optional debugging endpoint, disabled or rate-limited in production if not needed

## Rendering strategy
### Pre-render
Pre-render:
- home
- attribution page
- core hubs
- top 20k pages

### Dynamic Worker SSR
Render on demand:
- deeper tail pages
- preview pages
- diagnostics endpoints

## Contributor workflow
### Human-editable content
Contributors create or edit markdown override files under a structure such as:
- `content/overrides/en/german/zeitgeist.md`
- `content/overrides/en/chinese/qigong.md`
- `content/overrides/en/proper-nouns/xi-jinping.md`

### Contribution labels
Each override should support:
- language of page
- origin language
- topic tags
- review status
- native-speaker checked flag
- pronunciation dispute flag

### Review states
- `auto-imported`
- `human-edited`
- `native-reviewed`
- `editor-approved`
- `needs-source-check`
- `license-review-needed`

## Launch corpus recommendations
### English-first launch
- English pages for words searched in English.
- Pronunciation variants within English plus native/local variants where relevant.

### Seed categories
- German-origin English words.
- Chinese-origin English words.
- Proper nouns in politics/news.
- Academic terms, especially linguistics and philosophy.
- Commonly mispronounced brands and places.

### Ranking logic for seeds
- Start from wordfreq and/or other frequency estimates.
- Intersect with origin categories.
- Manually review top 100–500 in each origin bucket.

## Analytics and observability
- Privacy-friendly analytics only, or none at launch.
- Track page views, play button clicks, replay clicks, and 0.5x clicks.
- Track pages with repeated quick replays; those may indicate unclear audio.
- Log only minimal diagnostic metrics.

## Acceptance criteria for v1
- Deployable to Cloudflare.
- No database required at runtime.
- Handles at least 10,000 indexable pages and a larger backing corpus.
- Worker bundle remains small.
- Static assets remain under file-count limits.
- Audio playback works with 1x and 0.5x controls.
- Supports at least one hub page by origin language.
- Supports contributor markdown overrides.
- Generates XML sitemaps from eligible pages only.
- Generates attribution pages and machine-readable provenance manifests.

## Risks
- Licensing complexity from mixed data sources.
- Synthetic audio quality for hard proper nouns.
- Thin-page risk if pages are too bare.
- File-count limits if assets are generated naively.
- Git repo bloat if too much generated data is committed.

## Mitigations
- Keep generated data out of Git when possible.
- Keep per-field provenance.
- Use human override markdown only where needed.
- Start with a smaller indexable set.
- Add meaningful related links, glosses, and source notes.

## Open decisions with suggested defaults
1. **Should all entries be stored as markdown?**
   - Default: no. Use markdown only for overrides and curated entries.
2. **Should the site be multilingual at launch?**
   - Default: English-facing pages first, with multilingual pronunciation variants.
3. **Should autoplay happen on page load?**
   - Default: attempt and gracefully fall back; do not rely on it.
4. **Should all pages be indexable?**
   - Default: no. Index only the useful subset.
5. **Should WordNet or Wiktionary glosses be shown directly?**
   - Default: show short adapted glosses with provenance.
