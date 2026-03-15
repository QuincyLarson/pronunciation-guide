# Hard Words

Hard Words is a production-oriented, open-source pronunciation directory built for **Cloudflare Workers** with a **database-less runtime**.

It serves:

- static assets and prerendered core pages from **Workers Static Assets**
- dynamic long-tail word pages from a tiny **Worker**
- audio and optionally large corpus shards from **R2**
- contributor edits through **markdown overrides**
- the large base corpus through **generated JSON shards**, not one-file-per-word markdown

The canonical word route is `/w/:slug`.

## Why this architecture scales

The runtime does not depend on a relational database, client-side hydration, or a giant Worker bundle.

- The Worker computes a shard path from the slug and fetches **one small JSON shard per request**.
- High-value pages are prerendered into static assets for maximum cacheability.
- Long-tail pages stay available through dynamic SSR without generating one HTML file per word.
- Indexing is gated by page quality, provenance, related links, and licensing confidence so the sitemap stays clean.

## Stack

- TypeScript
- Cloudflare Workers
- Wrangler
- Workers Static Assets
- Cloudflare R2
- Zod
- Vitest
- Node-based build scripts
- Plain server-side template functions for word pages

## Repository layout

```text
src/
  worker/        Cloudflare Worker runtime
  templates/     Plain HTML render functions
  lib/           Shared utilities, build pipeline, scoring, linking
  types/         Zod schemas and shared types
  client/        Tiny browser JS for audio replay controls
content/
  overrides/     Human-edited markdown overrides
data/
  fixtures/      Local snapshot fixtures used for ingestion
  generated/     Local build outputs during development
scripts/         Stage entry points for import/normalize/merge/etc.
public/          Static assets copied into Workers Static Assets output
test/            Unit and integration-style tests
dist/public/     Generated static site output
```

## Sample corpus

The initial fixture corpus includes 20+ entries and exercises:

- German-origin words: `sprachbund`, `zeitgeist`, `schadenfreude`, `kindergarten`, `wanderlust`, `Porsche`
- Chinese-origin words: `qigong`, `tangzhong`, `feng shui`, `mahjong`, `Xi Jinping`, `Beijing`
- Proper nouns and news names: `Qatar`, `Doha`, `Nguyen`, `Xi Jinping`
- Commonly mispronounced terms: `epitome`, `hyperbole`, `chipotle`, `jalapeño`, `gyro`, `forte`, `cache`
- Medicine: `epinephrine`, `omeprazole`

The fixtures include:

- multiple pronunciation variants
- human-audio placeholders
- synthetic-audio metadata
- provenance and licensing metadata
- at least one intentional `noindex` case for testing sitemap gating

## Getting started

```bash
npm install
npm run build
npm test
```

To work locally with the Worker:

```bash
npm run dev
```

## Commands

- `npm run build` runs the full ingestion, merge, scoring, sharding, prerender, sitemap, and attribution pipeline
- `npm run build:import` imports local fixture snapshots
- `npm run build:normalize` normalizes source snapshots to a common schema
- `npm run build:merge` merges normalized entries and applies markdown overrides
- `npm run build:links` computes related/internal links
- `npm run build:score` computes quality scores and index eligibility
- `npm run build:shards` emits JSON shard files
- `npm run build:prerender` prerenders home, hubs, and top word pages
- `npm run build:sitemaps` generates sitemap index and child sitemaps
- `npm run build:attribution` generates the attribution page and machine-readable manifest
- `npm run check` runs TypeScript type-checking
- `npm test` runs the test suite
- `npm run deploy` builds and deploys with Wrangler

## Build pipeline

The build is intentionally stage-based so contributors can inspect artifacts between phases:

1. Import source snapshots from `data/fixtures/sources/`
2. Normalize each source to a common schema
3. Merge fields by precedence
4. Apply markdown overrides from `content/overrides/`
5. Compute related links
6. Compute quality score and `indexStatus`
7. Shard the corpus by page language and slug prefix
8. Prerender the home page, hub pages, and top pages
9. Generate XML sitemaps from eligible pages only
10. Generate attribution HTML plus `/attribution/manifest.json`

## Data model

The final entry schema includes:

- `id`
- `slug`
- `display`
- `language`
- `pos`
- `glosses`
- `shortGloss`
- `origin`
- `topics`
- `variants`
- `related`
- `confusions`
- `confusionNotes`
- `provenance`
- `qualityScore`
- `indexStatus`

Pronunciation variants carry:

- label
- locale
- IPA
- plain-English respelling
- audio metadata
- review status
- confidence

## Markdown overrides

Markdown overrides are for human fixes and curated notes, not for storing the entire corpus.

Example locations:

- [content/overrides/en/german/zeitgeist.md](/Users/m/Documents/code/pronunciation-guide/content/overrides/en/german/zeitgeist.md)
- [content/overrides/en/chinese/qigong.md](/Users/m/Documents/code/pronunciation-guide/content/overrides/en/chinese/qigong.md)
- [content/overrides/en/proper-nouns/qatar.md](/Users/m/Documents/code/pronunciation-guide/content/overrides/en/proper-nouns/qatar.md)

Overrides can replace or refine:

- glosses
- topic tags
- related links
- confusion notes
- pronunciation variants
- review state and badges
- long-form notes rendered into the page

## Routing

- `/` home page
- `/w/:slug` canonical pronunciation page
- `/origins/` origin hub index
- `/origins/:origin/` origin-language hubs
- `/topics/` topic hub index
- `/topics/:topic/` topic hubs
- `/attribution/` human-readable attribution page
- `/attribution/manifest.json` machine-readable attribution manifest
- `/api/lookup/:slug` tiny JSON lookup endpoint
- `/sitemap.xml` sitemap index

## SEO and indexing policy

Pages are only sitemap-eligible when they have:

- a stable slug
- at least one pronunciation variant
- at least one gloss
- provenance
- at least two useful internal links
- no unresolved licensing block
- no low-confidence audio block

Non-eligible pages are still routable, but they render `noindex,follow`.

## Audio

Word pages use a normal HTML `<audio>` element with tiny custom buttons for:

- replay at `1x`
- replay at `0.5x`

The sample project ships tiny WAV placeholders under `public/audio/fixtures/` so the controls work in local builds. In production, the same URL structure can point at R2-backed assets via `PUBLIC_AUDIO_BASE_URL`.

## Cloudflare deployment

`wrangler.jsonc` is configured for:

- Worker entry: `src/worker/index.ts`
- static assets directory: `dist/public`
- `AUDIO_BUCKET` R2 binding
- `CORPUS_BUCKET` R2 binding

Replace the placeholder values before deploying:

- bucket names
- `PUBLIC_SITE_URL`
- `PUBLIC_AUDIO_BASE_URL`

`CORPUS_SOURCE=assets` serves shards from Workers Static Assets.

For a larger corpus, switch to `CORPUS_SOURCE=r2` and upload `dist/public/data/shards/**/*` into the R2 corpus bucket using the same relative paths.

## Generated output

After `npm run build`, the important outputs are:

- `dist/public/w/...` prerendered top word pages
- `dist/public/data/shards/...` runtime shard files
- `dist/public/origins/...` hub pages
- `dist/public/topics/...` hub pages
- `dist/public/sitemaps/...` child sitemaps
- `dist/public/sitemap.xml` sitemap index
- `dist/public/attribution/index.html`
- `dist/public/attribution/manifest.json`

## Testing

The test suite covers:

- schema validation
- slug generation
- override merge logic
- related-link generation
- index eligibility rules
- word page rendering
- sitemap generation

## Licensing and attribution

Application code is licensed under the repository license.

Imported content and audio metadata are tracked separately through per-entry provenance and a generated attribution manifest. That separation matters for mixed-source datasets and future share-alike obligations.

## Notes for contributors

- Add large corpora through generated shard files, not by committing one markdown file per entry.
- Use markdown overrides only when a human needs to improve or curate a page.
- Keep the Worker runtime lean. Do not bundle the corpus into the Worker.
- Prefer adding provenance over silently “fixing” imported content.
