import { MAX_RELATED_LINKS } from "./constants";
import type { Entry, RelatedLink } from "../types/content";

interface Candidate {
  slug: string;
  label: string;
  reason: RelatedLink["reason"];
  priority: number;
}

function pushCandidate(map: Map<string, Candidate>, candidate: Candidate): void {
  const current = map.get(candidate.slug);
  if (!current || candidate.priority > current.priority) {
    map.set(candidate.slug, candidate);
  }
}

function shareAny(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

export function computeRelatedLinks(entries: Entry[]): Entry[] {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));

  return entries.map((entry) => {
    const candidates = new Map<string, Candidate>();

    for (const slug of entry.relatedSeedSlugs) {
      const target = bySlug.get(slug);
      if (!target || target.slug === entry.slug) {
        continue;
      }

      pushCandidate(candidates, {
        slug: target.slug,
        label: target.display,
        reason: "manual",
        priority: 100
      });
    }

    for (const slug of entry.confusions) {
      const target = bySlug.get(slug);
      if (!target || target.slug === entry.slug) {
        continue;
      }

      pushCandidate(candidates, {
        slug: target.slug,
        label: target.display,
        reason: "confusion-cluster",
        priority: 95
      });
    }

    for (const slug of entry.semanticLinkSlugs) {
      const target = bySlug.get(slug);
      if (!target || target.slug === entry.slug) {
        continue;
      }

      pushCandidate(candidates, {
        slug: target.slug,
        label: target.display,
        reason: "semantic",
        priority: 80
      });
    }

    for (const target of entries) {
      if (target.slug === entry.slug) {
        continue;
      }

      if (
        entry.origin.sourceLanguage &&
        entry.origin.sourceLanguage === target.origin.sourceLanguage
      ) {
        pushCandidate(candidates, {
          slug: target.slug,
          label: target.display,
          reason: "origin",
          priority: shareAny(entry.topics, target.topics) ? 75 : 65
        });
      }

      if (shareAny(entry.topics, target.topics)) {
        pushCandidate(candidates, {
          slug: target.slug,
          label: target.display,
          reason: "topic",
          priority: 55
        });
      }

      if (
        entry.display !== target.display &&
        entry.display[0]?.toLowerCase() === target.display[0]?.toLowerCase() &&
        entry.origin.sourceLanguage === target.origin.sourceLanguage
      ) {
        pushCandidate(candidates, {
          slug: target.slug,
          label: target.display,
          reason: "transliteration",
          priority: 45
        });
      }
    }

    const related = [...candidates.values()]
      .sort((left, right) => right.priority - left.priority || left.slug.localeCompare(right.slug))
      .slice(0, MAX_RELATED_LINKS)
      .map<RelatedLink>((candidate) => ({
        slug: candidate.slug,
        label: candidate.label,
        reason: candidate.reason,
        priority: candidate.priority
      }));

    return {
      ...entry,
      related
    };
  });
}
