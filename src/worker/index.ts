import { renderNotFoundPage } from "../templates/not-found-page";
import { renderWordPage } from "../templates/word-page";
import { buildSiteConfig, type SiteEnvLike } from "../lib/site-config";
import { getLookupShardPath } from "../lib/shards";
import { entrySchema, shardFileSchema, type Entry } from "../types/content";

interface AssetBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface R2ObjectLike {
  text(): Promise<string>;
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
}

export interface Env extends SiteEnvLike {
  ASSETS: AssetBinding;
  CORPUS_BUCKET?: R2BucketLike;
  CORPUS_SOURCE?: "assets" | "r2";
}

function htmlResponse(html: string, status = 200, cacheControl = "public, max-age=300, s-maxage=86400"): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheControl
    }
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300"
    }
  });
}

async function maybeServeStaticAsset(request: Request, env: Env): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }

  const response = await env.ASSETS.fetch(request);
  return response.status === 404 ? null : response;
}

async function loadShard(pathname: string, env: Env, requestUrl: string): Promise<Entry | null> {
  const relativePath = getLookupShardPath(pathname).replace(/^\//, "");
  let raw: string | null = null;

  if (env.CORPUS_SOURCE === "r2" && env.CORPUS_BUCKET) {
    const object = await env.CORPUS_BUCKET.get(relativePath);
    raw = object ? await object.text() : null;
  } else {
    const assetRequest = new Request(new URL(`/${relativePath}`, requestUrl).toString());
    const response = await env.ASSETS.fetch(assetRequest);
    raw = response.ok ? await response.text() : null;
  }

  if (!raw) {
    return null;
  }

  const shard = shardFileSchema.parse(JSON.parse(raw));
  const match = shard.entries.find((entry) => entry.slug === pathname);
  return match ? entrySchema.parse(match) : null;
}

function notFound(env: Env): Response {
  return htmlResponse(renderNotFoundPage(buildSiteConfig(env)), 404, "public, max-age=60, s-maxage=300");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const staticResponse = await maybeServeStaticAsset(request, env);
    if (staticResponse) {
      return staticResponse;
    }

    const url = new URL(request.url);
    const config = buildSiteConfig(env);

    if (url.pathname.startsWith("/w/")) {
      const slug = decodeURIComponent(url.pathname.slice(3).replace(/\/$/, ""));
      if (!slug) {
        return notFound(env);
      }

      const entry = await loadShard(slug, env, request.url);
      if (!entry) {
        return notFound(env);
      }

      return htmlResponse(renderWordPage(entry, config));
    }

    if (url.pathname.startsWith("/api/lookup/")) {
      const slug = decodeURIComponent(url.pathname.slice("/api/lookup/".length).replace(/\/$/, ""));
      if (!slug) {
        return jsonResponse({ error: "Missing slug" }, 400);
      }

      const entry = await loadShard(slug, env, request.url);
      if (!entry) {
        return jsonResponse({ error: "Not found" }, 404);
      }

      return jsonResponse({
        slug: entry.slug,
        display: entry.display,
        gloss: entry.shortGloss ?? entry.glosses[0] ?? null,
        variants: entry.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          locale: variant.locale,
          ipa: variant.ipa,
          respelling: variant.respelling,
          audioKind: variant.audio.kind,
          reviewStatus: variant.audio.reviewStatus
        })),
        related: entry.related,
        indexStatus: entry.indexStatus
      });
    }

    return notFound(env);
  }
};
