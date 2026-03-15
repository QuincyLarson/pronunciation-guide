export interface HubDefinition {
  slug: string;
  title: string;
  description: string;
  intro: string;
}

function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export const originHubDefinitions: Record<string, HubDefinition> = {
  root: {
    slug: "origins",
    title: "Origin Language Hubs",
    description: "Browse pronunciation pages by source language and borrowing history.",
    intro:
      "These hubs gather English-facing pronunciation pages by origin language so related loanwords and names stay discoverable without turning into thin tag dumps."
  },
  german: {
    slug: "german",
    title: "German-Origin Words",
    description: "Loanwords and proper names borrowed into English from German.",
    intro:
      "German-origin English words often preserve consonant clusters and vowel values that English speakers flatten. This hub keeps the most useful examples together."
  },
  chinese: {
    slug: "chinese",
    title: "Chinese-Origin Words",
    description: "Pronunciation pages for English words and names rooted in Chinese.",
    intro:
      "Chinese-origin words need explicit variant labeling because English approximations, Pinyin spellings, and local pronunciations often diverge in predictable ways."
  },
  spanish: {
    slug: "spanish",
    title: "Spanish-Origin Words",
    description: "Borrowed words and names whose common English pronunciation differs from Spanish.",
    intro:
      "Spanish loanwords often show predictable stress shifts once they enter English. These entries highlight where English usage and native pronunciation part ways."
  },
  greek: {
    slug: "greek",
    title: "Greek-Origin Words",
    description: "English words that preserve or distort Greek pronunciation patterns.",
    intro:
      "Greek-origin words are common in science, medicine, and food writing. This hub collects the ones English speakers most often hesitate over."
  },
  vietnamese: {
    slug: "vietnamese",
    title: "Vietnamese-Origin Names",
    description: "Common Vietnamese names and pronunciation guides for English speakers.",
    intro:
      "Vietnamese names are widely searched and widely mispronounced. These pages compare common English approximations with respectful local variants."
  },
  arabic: {
    slug: "arabic",
    title: "Arabic-Origin Names and Places",
    description: "News names and place names with Arabic-origin pronunciation variants.",
    intro:
      "Newsroom pronunciations can diverge sharply from local pronunciation. This hub keeps those variants explicit and sourced."
  }
};

export const topicHubDefinitions: Record<string, HubDefinition> = {
  root: {
    slug: "topics",
    title: "Topic Hubs",
    description: "Browse by editorial topic clusters instead of giant taxonomies.",
    intro:
      "Topic hubs group pronunciation pages into small, useful clusters. Each one is curated for likely practice and discovery, not just exhaustiveness."
  },
  "news-names": {
    slug: "news-names",
    title: "News Names",
    description: "People, places, and terms that are frequently spoken on air.",
    intro:
      "These are the names most likely to matter in broadcasts, interviews, classrooms, and quick live reads where confidence matters."
  },
  academic: {
    slug: "academic",
    title: "Academic Terms",
    description: "Linguistics, rhetoric, and other academic terms that are commonly hesitated over.",
    intro:
      "Academic vocabulary often gets read more than spoken. This hub focuses on terms that benefit from explicit audio and respellings."
  },
  brands: {
    slug: "brands",
    title: "Brands",
    description: "Brand names and company names with high public speaking value.",
    intro:
      "Brands travel globally and accumulate local variants. These entries capture the English-facing version people most often need alongside native cues."
  },
  medicine: {
    slug: "medicine",
    title: "Medicine",
    description: "Medical vocabulary and drug names that deserve careful playback.",
    intro:
      "Medical terms are high-stakes and often learned from print. These pages prioritize clarity, slow replay, and source visibility."
  },
  places: {
    slug: "places",
    title: "Places",
    description: "Place names and geography pages with multiple pronunciation norms.",
    intro:
      "Place names often split between local pronunciation and English newsroom usage. These pages keep both available without hiding the difference."
  },
  loanwords: {
    slug: "loanwords",
    title: "Loanwords",
    description: "English loanwords whose pronunciation often drifts from the source language.",
    intro:
      "Loanwords are where this project starts: useful pages with context, variants, and provenance instead of raw IPA alone."
  }
};

export function hubLabel(slug: string): string {
  return labelFromSlug(slug);
}
