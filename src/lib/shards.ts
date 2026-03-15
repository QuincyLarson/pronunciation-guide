import { DEFAULT_LANGUAGE, SHARD_PREFIX_LENGTH, SHARD_ROOT } from "./constants";

export function getShardKey(slug: string): string {
  const padded = `${slug.slice(0, SHARD_PREFIX_LENGTH)}__`;
  return padded.slice(0, SHARD_PREFIX_LENGTH);
}

export function getShardPath(language: string, slug: string): string {
  return `${SHARD_ROOT}/${language}/${getShardKey(slug)}.json`;
}

export function getWordPath(slug: string): string {
  return `/w/${slug}`;
}

export function getLookupShardPath(slug: string, language = DEFAULT_LANGUAGE): string {
  return `/${getShardPath(language, slug)}`;
}
