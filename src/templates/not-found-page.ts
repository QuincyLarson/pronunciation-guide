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
      <p class="hero-gloss">Try an origin hub, a topic hub, or one of the featured pronunciation pages instead.</p>
      <p><a class="button-link" href="/">Go back home</a></p>
    </section>`
  });
}
