import { escapeHtml } from "../lib/html";
import { absoluteUrl, type SiteConfig } from "../lib/site-config";

interface LayoutProps {
  title: string;
  description: string;
  pathname: string;
  main: string;
  robots?: string;
  scripts?: string[];
}

export function renderLayout(config: SiteConfig, props: LayoutProps): string {
  const canonicalUrl = absoluteUrl(config, props.pathname);
  const robots = props.robots ?? "index,follow";
  const scripts = props.scripts ?? [];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(props.title)}</title>
    <meta name="description" content="${escapeHtml(props.description)}">
    <meta name="robots" content="${escapeHtml(robots)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/site.css">
    ${scripts.map((src) => `<script type="module" src="${escapeHtml(src)}" defer></script>`).join("")}
  </head>
  <body>
    <header class="site-header">
      <div class="shell">
        <a class="brand" href="/">${escapeHtml(config.siteName)}</a>
        <nav class="site-nav" aria-label="Primary">
          <a href="/learn-ipa/">Learn IPA</a>
          <a href="/browse/">Browse</a>
          <a href="/origins/">Origins</a>
          <a href="/topics/">Topics</a>
          <a href="/attribution/">Attribution</a>
          <a href="${escapeHtml(config.repoUrl)}">GitHub</a>
        </nav>
      </div>
    </header>
    <main class="shell">
      ${props.main}
    </main>
    <footer class="site-footer shell">
      <p>${escapeHtml(config.siteTagline)}</p>
      <p><a href="/attribution/">Licenses and attribution</a></p>
    </footer>
  </body>
</html>
`;
}
