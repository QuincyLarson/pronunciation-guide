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

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(href);
}

export function renderLayout(config: SiteConfig, props: LayoutProps): string {
  const canonicalUrl = absoluteUrl(config, props.pathname);
  const robots = props.robots ?? "index,follow";
  const scripts = [...(props.scripts ?? []), "/assets/client/site-search.js"];
  const navItems = [
    { href: "/learn-ipa/", label: "Curriculum" },
    { href: "/learn-ipa/reference/", label: "Reference" },
    { href: "/browse/", label: "Word Pages" }
  ];

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
      <div class="shell site-header-inner">
        <a class="brand" href="/">
          <span class="brand-mark">/ɪˈpeɪ/</span>
          <span class="brand-copy">
            <span class="brand-label">${escapeHtml(config.siteName)}</span>
            <span class="brand-subtitle">curriculum first</span>
          </span>
        </a>
        <nav class="site-nav" aria-label="Primary">
          ${navItems
            .map(
              (item) =>
                `<a href="${escapeHtml(item.href)}"${
                  isCurrentPath(props.pathname, item.href) ? ' aria-current="page"' : ""
                }>${escapeHtml(item.label)}</a>`
            )
            .join("")}
        </nav>
        <form class="search-form site-search" data-site-search-form role="search" aria-label="Search words">
          <label class="sr-only" for="site-search-input">Search words</label>
          <input id="site-search-input" type="search" name="q" placeholder="Jump to a word" autocomplete="off">
          <button type="submit" class="button-link subtle">Search</button>
        </form>
      </div>
    </header>
    <main class="shell site-main">
      ${props.main}
    </main>
    <footer class="site-footer">
      <div class="shell site-footer-inner">
        <p>${escapeHtml(config.siteTagline)}</p>
        <nav class="site-footer-links" aria-label="Footer">
          <a href="/learn-ipa/">Curriculum</a>
          <a href="/learn-ipa/reference/">Reference</a>
          <a href="/browse/">Word pages</a>
          <a href="/attribution/">Attribution</a>
          <a href="${escapeHtml(config.repoUrl)}">GitHub</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}
