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

The fixture corpus now includes exactly 1000 unique entries. It combines a curated base set with generated seed batches so the build and routing path can be exercised at realistic directory scale.

The curated slice still exercises:

- German-origin words: `sprachbund`, `zeitgeist`, `schadenfreude`, `kindergarten`, `wanderlust`, `Porsche`
- Chinese-origin words: `qigong`, `tangzhong`, `feng shui`, `mahjong`, `Xi Jinping`, `Beijing`
- Proper nouns and news names: `Qatar`, `Doha`, `Nguyen`, `Xi Jinping`
- Commonly mispronounced terms: `epitome`, `hyperbole`, `chipotle`, `jalapeño`, `gyro`, `forte`, `cache`
- Medicine: `epinephrine`, `omeprazole`

Across the full fixture set, the project includes:

- multiple pronunciation variants
- human-audio placeholders
- synthetic-audio metadata
- provenance and licensing metadata
- at least one intentional `noindex` case for testing sitemap gating
- generated batch coverage for uncommon words and proper names

## Getting started

```bash
npm install
npm run build
npm test
```

To work locally with the Worker:

```bash
npm run dev -- --port 8787 --ip 127.0.0.1
```

Then open [http://127.0.0.1:8787](http://127.0.0.1:8787).

Useful pages to inspect locally:

- [http://127.0.0.1:8787/](http://127.0.0.1:8787/)
- [http://127.0.0.1:8787/w/qatar](http://127.0.0.1:8787/w/qatar)
- [http://127.0.0.1:8787/w/qigong](http://127.0.0.1:8787/w/qigong)
- [http://127.0.0.1:8787/origins/german/](http://127.0.0.1:8787/origins/german/)
- [http://127.0.0.1:8787/topics/news-names/](http://127.0.0.1:8787/topics/news-names/)
- [http://127.0.0.1:8787/attribution/](http://127.0.0.1:8787/attribution/)

## Commands

- `npm run build` runs the full ingestion, merge, scoring, sharding, prerender, sitemap, and attribution pipeline
- `npm run build:import` imports local fixture snapshots
- `npm run build:normalize` normalizes source snapshots to a common schema
- `npm run build:merge` merges normalized entries and applies markdown overrides
- `npm run build:links` computes related/internal links
- `npm run build:score` computes quality scores and index eligibility
- `npm run build:audio` materializes spoken preview audio for placeholder fixture variants when local speech synthesis is available
- `npm run build:shards` emits JSON shard files
- `npm run build:prerender` prerenders home, hubs, and top word pages
- `npm run build:sitemaps` generates sitemap index and child sitemaps
- `npm run build:attribution` generates the attribution page and machine-readable manifest
- `npm run fixtures:generate-batch -- --count 100 --target 1000` adds the next deterministic fixture batch from local system word/name lists
- `npm run check` runs TypeScript type-checking
- `npm test` runs the test suite
- `npm run deploy` builds and deploys with Wrangler
- `npm run r2:sync:corpus -- --remote` uploads built shard files to the configured corpus bucket
- `npm run r2:sync:audio -- --remote` uploads built audio files to the configured audio bucket

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

The batch generator writes additional fixture files into `data/fixtures/sources/generated/`. The importer automatically loads every `wiktionary*.json` batch from `data/fixtures/sources/`, so contributors can scale the fixture corpus without changing runtime code.

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

The sample project still includes tiny fallback WAV placeholders under `public/audio/fixtures/`, but the build now materializes per-word spoken preview audio into `dist/public/audio/generated/` when local speech synthesis is available. On macOS, it uses `say` plus `afconvert` during `npm run build`.

If local speech synthesis is not available, the project falls back to the fixture placeholders.

In production, the same URL structure can point at R2-backed assets via `PUBLIC_AUDIO_BASE_URL`.

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

For local development, the placeholder bucket names are syntactically valid so `wrangler dev` can start without editing them first.

`CORPUS_SOURCE=assets` serves shards from Workers Static Assets.

For a larger corpus, switch to `CORPUS_SOURCE=r2` and upload `dist/public/data/shards/**/*` into the R2 corpus bucket using the same relative paths.

If you want the Worker to serve audio directly from R2 at `/audio/...`, upload `dist/public/audio/**/*` into the configured audio bucket with the same relative paths. The Worker falls back to `AUDIO_BUCKET` when a local static audio asset is not present.

Typical deploy sequence:

```bash
npm run build
npm run r2:sync:corpus -- --remote
npm run r2:sync:audio -- --remote
npm run deploy
```

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
