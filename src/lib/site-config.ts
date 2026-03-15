import {
  DEFAULT_AUDIO_BASE_URL,
  DEFAULT_REPO_URL,
  DEFAULT_SITE_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TITLE_SUFFIX
} from "./constants";

export interface SiteConfig {
  siteName: string;
  siteTitleSuffix: string;
  siteTagline: string;
  siteDescription: string;
  siteUrl: string;
  audioBaseUrl: string;
  repoUrl: string;
}

export interface SiteEnvLike {
  PUBLIC_SITE_URL?: string;
  PUBLIC_AUDIO_BASE_URL?: string;
  REPO_URL?: string;
}

export function buildSiteConfig(env?: SiteEnvLike): SiteConfig {
  return {
    siteName: SITE_NAME,
    siteTitleSuffix: SITE_TITLE_SUFFIX,
    siteTagline: SITE_TAGLINE,
    siteDescription: SITE_DESCRIPTION,
    siteUrl: trimTrailingSlash(env?.PUBLIC_SITE_URL ?? DEFAULT_SITE_URL),
    audioBaseUrl: trimTrailingSlash(env?.PUBLIC_AUDIO_BASE_URL ?? DEFAULT_AUDIO_BASE_URL),
    repoUrl: env?.REPO_URL ?? DEFAULT_REPO_URL
  };
}

export function absoluteUrl(config: SiteConfig, pathname: string): string {
  return new URL(pathname, `${config.siteUrl}/`).toString();
}

export function audioUrl(config: SiteConfig, src: string): string {
  if (/^https?:\/\//.test(src)) {
    return src;
  }

  if (!config.audioBaseUrl) {
    return src;
  }

  return `${config.audioBaseUrl}${src.startsWith("/") ? src : `/${src}`}`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
