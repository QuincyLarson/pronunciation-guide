# AGENTS.md

## Mission
This repository builds an interactive browser-based pronunciation and IPA learning experience in the style of freeCodeCamp:
- lesson-based
- highly interactive
- incremental
- motivating
- accessible
- mobile-friendly
- easy to resume across sessions

The product should feel polished and educational, not like a prototype.

## Product goals
The app should teach pronunciation and IPA progressively to English-speaking learners by:
- introducing a few symbols at a time
- grounding each symbol in familiar example words
- explaining only the minimum necessary linguistics concepts at the right time
- reinforcing learning through repetition and recall
- building confidence through short, frequent wins

The tone should be clear, friendly, and efficient.
Avoid over-explaining linguistics when a simpler learner-facing explanation will do.

## Pedagogical principles
When implementing lessons or exercises, optimize for:
1. progressive disclosure
2. short feedback loops
3. retrieval practice over passive reading
4. spaced repetition where practical
5. low cognitive load
6. immediate corrective feedback
7. cumulative review of previously learned symbols

Every lesson should answer:
- what is this sound/symbol?
- what does it sound like in a familiar word?
- how is it different from nearby/confusable sounds?
- can the learner recognize and use it immediately?

## Scope assumptions
Assume:
- no database is required
- progress can be stored locally using localStorage or similar browser storage
- the app should work well as a static or mostly static web app
- the user experience should be excellent on mobile and desktop
- lessons should be resumable between sessions

Do not add a backend unless absolutely necessary.

## Technical principles
- Favor simple architecture and low operational complexity.
- Keep the app easy to deploy as a static site where possible.
- Minimize external services and moving parts.
- Prefer deterministic behavior and transparent state management.
- Do not introduce unnecessary global complexity.

## UX standards
When changing the UI:
- maintain a coherent visual system
- optimize for touch interaction on mobile
- ensure keyboard accessibility on desktop
- include clear progress indicators
- include strong feedback for correct/incorrect answers
- avoid clutter
- keep learner attention on the current task

Important:
- do not bury the primary learning action
- keep each screen focused on one core action
- prefer large tappable controls
- preserve momentum between questions

## Lesson design standards
Each lesson should usually contain:
1. a brief concept intro
2. one or two anchored examples
3. guided practice
4. recall practice
5. a quick checkpoint
6. cumulative review where appropriate

When generating content:
- prefer common English words
- avoid obscure vocabulary unless pedagogically necessary
- avoid regional pronunciation edge cases unless the lesson is explicitly about variation
- flag likely dialect-sensitive content in comments or notes for later review

## Content modeling
When creating lesson data, design structures that support:
- symbols
- example words
- hints
- confusable pairs
- mastery status
- spaced repetition metadata
- lesson prerequisites
- review queues

Prefer extensible but simple schemas.

## State and progress
Persist enough client-side state to support:
- lesson completion
- current streak/progress
- symbol mastery
- review scheduling
- session resume
- lightweight settings

Be careful with migrations if stored data structures change.

## Engineering workflow
For any substantial task:
1. inspect the relevant files first
2. create a short plan
3. implement in small increments
4. run tests and typechecks after each milestone
5. commit each stable milestone
6. summarize what changed and any remaining risks

Never leave large uncommitted changes if a coherent checkpoint can be committed.

## Testing expectations
For meaningful changes, add or update tests for:
- lesson progression logic
- scoring/evaluation logic
- spaced repetition behavior
- progress persistence
- regression-prone UI state transitions

Prefer focused tests over broad brittle ones.

## Performance expectations
- keep first-load performance snappy
- avoid large unnecessary bundles
- lazy-load where it materially helps
- do not introduce heavy dependencies without clear benefit

## Accessibility expectations
- semantic markup where possible
- keyboard navigable interactions
- visible focus states
- color is never the only signal
- text/audio controls should be understandable to screen-reader users where feasible

## Commit expectations
Use small, descriptive commits.
Examples:
- feat: add symbol mastery state and review queue
- feat: implement guided IPA lesson card flow
- fix: preserve lesson resume state across refresh
- test: cover confusable-sound answer evaluation

## When making tradeoffs
Prefer:
- simpler implementation
- better learner experience
- easier maintenance
- fewer moving parts
- reviewable diffs

## Avoid
- unnecessary rewrites
- adding a backend
- over-engineering spaced repetition
- giant one-shot commits
- introducing features that distract from the learning loop