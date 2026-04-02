import type { SiteConfig } from "../lib/site-config";
import { renderLayout } from "./layout";

export function renderNotFoundPage(config: SiteConfig): string {
  return renderLayout(config, {
    title: `Not found | ${config.siteTitleSuffix}`,
    description: "The requested pronunciation page was not found.",
    pathname: "/404.html",
    robots: "noindex,follow",
    main: `<section class="hero">
      <p class="eyebrow">404</p>
      <h1>Page not found</h1>
      <p class="hero-gloss">Try the curriculum, the reference, or another word page.</p>
      <div class="hero-actions">
        <a class="button-link" href="/learn-ipa/">Open curriculum</a>
        <a class="button-link subtle" href="/browse/">Word pages</a>
      </div>
    </section>`
  });
}
