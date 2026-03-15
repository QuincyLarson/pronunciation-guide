import path from "node:path";

const root = process.cwd();

export const PROJECT_ROOT = root;
export const FIXTURE_DIR = path.join(root, "data", "fixtures", "sources");
export const OVERRIDES_DIR = path.join(root, "content", "overrides");
export const GENERATED_DIR = path.join(root, "data", "generated");
export const STAGES_DIR = path.join(GENERATED_DIR, "stages");
export const GENERATED_SHARDS_DIR = path.join(GENERATED_DIR, "shards");
export const DIST_DIR = path.join(root, "dist");
export const DIST_PUBLIC_DIR = path.join(DIST_DIR, "public");
export const DIST_SHARDS_DIR = path.join(DIST_PUBLIC_DIR, "data", "shards");
export const PUBLIC_DIR = path.join(root, "public");

export const IMPORTED_SOURCES_PATH = path.join(STAGES_DIR, "imported-sources.json");
export const NORMALIZED_SOURCES_PATH = path.join(STAGES_DIR, "normalized-sources.json");
export const MERGED_CORPUS_PATH = path.join(STAGES_DIR, "merged-corpus.json");
export const LINKED_CORPUS_PATH = path.join(STAGES_DIR, "linked-corpus.json");
export const SCORED_CORPUS_PATH = path.join(STAGES_DIR, "scored-corpus.json");
export const ATTRIBUTION_MANIFEST_PATH = path.join(GENERATED_DIR, "attribution-manifest.json");
export const SITE_MANIFEST_PATH = path.join(GENERATED_DIR, "site-manifest.json");
