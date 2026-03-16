# Learn IPA Research Notes

This note preserves the main curricular assumptions behind `/learn-ipa` so contributors can refine the content and generator without re-deriving the launch logic from scratch.

## Scope

The course teaches the site's **house transcription profile**, not all of IPA. The launch target is practical reading:

- broad English dictionary transcription
- common stress and length marks
- the highest-value non-English sounds that recur in names and loanwords on the site

It intentionally omits narrow phonetic detail, extIPA, and maximalist chart coverage.

## Priority signals

The curriculum source model is designed around four signals:

1. Coverage of the site's own pronunciation corpus.
2. Utility across recurring origin-language clusters.
3. Confusion risk for an English-speaking learner.
4. Availability of short, teachable examples with usable audio.

The current fixture-backed launch uses a manually authored approximation of those signals in `data/ipa/symbols.yaml` and `data/ipa/lesson-plan.yaml`. When real-source ingestion expands, the same generator should be able to derive stronger priority scores from corpus statistics.

## Content layers

Human-authored files:

- `content/ipa/modules/*.md`
- `content/ipa/concepts/*.md`

Generated/structured sources:

- `data/ipa/symbols.yaml`
- `data/ipa/examples.yaml`
- `data/ipa/lesson-plan.yaml`

Generated outputs:

- `data/generated/ipa/curriculum.json`
- `data/generated/ipa/lookup.json`

## Lesson design assumptions

- Lessons stay small: 1 to 3 new teachable items, then practice.
- Concepts are only introduced when they unlock better decoding.
- Review is local-first and deterministic.
- The core loop favors decoding, listening, and transfer over theory density.

## Review model

The current local scheduler is intentionally simple and debuggable:

- `failed`
- `hard`
- `good`
- `easy`

The goal is not perfect memorization science at launch. The goal is to keep symbol and concept review cheap, inspectable, and easy to migrate later.

## Product-loop integration

The course is meant to feed and be fed by the main directory:

- homepage and navbar CTA
- word-page deep links for symbol lessons
- indexable module/reference pages for browseability
- local progress hint on word pages for returning learners

If those integrations drift, the course stops being part of the product and turns into a detached side tool. That is specifically what this implementation is trying to avoid.
