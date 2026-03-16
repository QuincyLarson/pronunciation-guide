
# PRD Addendum: Learn IPA Experience

This addendum is meant to be appended to the existing pronunciation-directory PRD. It adds a lightweight `/learn-ipa` experience that lives inside the same Cloudflare deployment and reuses the same pronunciation corpus, audio pipeline, and contributor workflow.

---

## Working title

Learn IPA — a freeCodeCamp-style interactive course that teaches an English speaker to read the subset of IPA that matters for English dictionary transcriptions and the major European and Asian loanword/name cases covered by the pronunciation directory.

---

## Product thesis

Most people do not need to become phoneticians. They need three practical outcomes:

1. Read the IPA that actually appears on modern English-facing pronunciation pages.
2. Decode unfamiliar names and loanwords without panic.
3. Build a lifelong mental model of how speech sounds are organized.

The course should therefore teach **the site's house IPA profile**, not “all possible IPA ever used in all linguistic traditions.” It should be broad enough that learners can read most IPA they will encounter in dictionaries and on this site, but opinionated enough to stay simple.

The course should feel like freeCodeCamp:
- short, focused, self-paced
- practice-heavy
- immediate feedback
- low visual clutter
- clear next step
- satisfying but brief celebration on completion

---

## Strategic recommendation

### The biggest design decision
Do **not** make `/learn-ipa` a pile of static lesson pages. Make it a **single client-side app** with:
- one indexable landing page (`/learn-ipa`)
- optional indexable module overview pages if they have substantial content
- internal step states handled in the SPA
- deep lesson/step routes either canonicalized to `/learn-ipa` or marked `noindex`

This avoids creating dozens or hundreds of thin URLs while still giving users a structured curriculum.

### The second biggest design decision
Do **not** manually author 100–200 lessons from scratch. Instead:
- define a machine-readable symbol inventory
- define prerequisite relationships between symbols and concepts
- define reusable challenge templates
- define example word pools
- generate lesson drafts automatically
- allow markdown/YAML overrides for editorial improvement

This keeps the curriculum open source and maintainable.

### The third biggest design decision
Do **not** make microphone grading a launch blocker. Ship the course with:
1. excellent read-and-listen practice,
2. spaced repetition,
3. mixed review,
4. optional self-record and playback,
5. experimental mic scoring behind a feature flag.

Static browser-only pronunciation scoring is possible in limited ways, but it will be approximate. The main learning value comes from repeated decoding + listening + review.

---

## Goals

- Add a prominent “Learn to read IPA!” call to action on the homepage and navbar.
- Teach enough IPA in roughly 120–150 short steps that a learner can read nearly all site transcriptions except the most specialized/extIPA material.
- Reuse the main pronunciation corpus for examples, audio, origin-language packs, and related words.
- Require no server-side database.
- Persist progress across sessions using browser storage.
- Keep the initial learning shell extremely lightweight.
- Keep the learning experience accessible, keyboard-friendly, and mobile-friendly.
- Make the course content open source and easy to refine by contributors.

---

## Non-goals

- Full linguistics degree.
- Full coverage of clicks, implosives, extIPA, highly narrow transcription, or every tone system.
- Real-time cloud-quality pronunciation assessment in v1.
- Accounts, sync, leaderboards, social features, or backend personalization.
- Turning each step into an SEO landing page.

---

## User types

### Primary
1. Curious English speakers who want to “finally understand what all those symbols mean.”
2. People who repeatedly use pronunciation pages and want long-term payoff.
3. Contributors who know specific language-origin areas and want to improve lessons/examples.

### Secondary
1. Teachers and self-learners who want a simple IPA drill tool.
2. Public speakers / creators who often need proper nouns and foreign terms.
3. Language learners who want a pronunciation-notation bridge.

---

## User stories

- As a beginner, I want to learn only a few symbols at a time using short familiar words.
- As a learner, I want a lot of practice and review so the symbols actually stick.
- As a learner, I want to hear the correct sound immediately after trying.
- As a learner, I want a mixed “bonus round” every few steps to prove I can read sequences.
- As a returning learner, I want the app to remember where I left off.
- As a pronunciation-site visitor, I want to click from a word page into the exact IPA lessons that explain its symbols.
- As a contributor, I want to edit lesson content and example metadata without touching a database.
- As a privacy-conscious user, I want the course to work without creating an account.

---

## Success criteria

### Product success
- A learner can complete the core track in multiple short sittings.
- A learner can decode mixed IPA strings with substantially less hesitation by the end of the core track.
- The learn module drives repeat visits back into the main pronunciation directory.
- The project remains deployable on Cloudflare with static assets + Worker routing only.

### Curriculum success
- Every explicitly taught symbol appears in multiple contexts and multiple later reviews.
- No lesson introduces more than 3 new teachable items.
- Core English and high-value international symbols are covered before niche symbols.
- The course teaches concepts only when they unlock decoding ability.

### Technical success
- Learning shell loads fast on mobile.
- Progress survives refreshes and later sessions.
- Audio playback feels immediate after user gesture.
- Experimental mic mode never blocks the main learning loop or degrades app responsiveness.

---

## Product principles

- Teach the site's transcription system, not abstract IPA maximalism.
- Audio first, decoding second, theory third.
- Every concept must unlock better reading.
- Keep lessons tiny.
- Interleave review constantly.
- Prefer familiar short English words first.
- Add names and loanwords only after the learner has enough decoding skill.
- Keep deep step URLs out of the index unless they provide real standalone value.
- Preserve contributor friendliness through file-based content.

---

## Information architecture

### Public routes
- `/learn-ipa` — landing page + app shell
- `/learn-ipa/module/<slug>` — optional static/indexable module overview pages
- `/learn-ipa/reference` — IPA reference / symbol catalog
- `/learn-ipa/progress` — optional local-only progress summary inside SPA
- `/learn-ipa/about` — what the course teaches and what it omits

### Internal SPA routes / states
- `/learn-ipa/step/<id>` or hash/state routing
- these should not be relied on as indexable pages
- canonical should generally point to `/learn-ipa` or the parent module page

### Integration points with the main site
- homepage CTA: “Learn to read IPA!”
- navbar link: “Learn IPA”
- on word pages:
  - “Learn these symbols” chips
  - “You know 3/5 symbols in this word” progress hint for returning learners
  - deep links to relevant lessons for symbols or concepts

---

## SEO policy for the learning experience

### Index
- `/learn-ipa`
- module overview pages only if they contain substantial explanatory copy and curated examples
- `/learn-ipa/reference` if it is genuinely useful as a standalone guide

### Do not index
- single challenge steps
- ultra-thin generated lesson states
- duplicate accent-variant step URLs
- transient review states
- mic test states

### Reason
The learning course should support the product, not create hundreds of thin pages that look like scaled content. The indexable learning pages should be rich, browseable, and useful even without finishing a step sequence.

---

## Pedagogical model

### What to teach explicitly
Teach symbols that are:
1. common in the site's corpus,
2. common in English-facing dictionary/transcription use,
3. likely to confuse an English speaker,
4. useful across major European and Asian loanwords/names.

### What to teach implicitly
Do **not** spend precious lesson budget explicitly teaching symbols whose IPA value is obvious to an English-speaking beginner in broad transcription, unless they participate in an important contrast. Examples:
- `m`
- `n`
- `p`
- `b`
- `t`
- `d`
- `k`
- `g`
- `f`
- `v`
- `s`
- `z`
- `l`
- `w`

Use these in examples from the start. Let learners infer them through context and repetition.

### Core concept order
1. One symbol = one sound idea.
2. Short familiar vowels.
3. Schwa and vowel reduction.
4. Common English consonant symbols that are visually non-obvious.
5. Stress and length.
6. Accent labels and variant pronunciations.
7. High-value international sounds by origin-language cluster.
8. Selected suprasegmentals / diacritics only as needed.

---

## Data-driven curriculum generation strategy

The ordering should not be arbitrary. Generate symbol priority from four weighted signals:

### 1) Site corpus frequency
How often a symbol appears in your own pronunciation corpus, weighted by page demand.

Use the pronunciation directory corpus as the primary source of truth:
- extract all IPA tokens from the site's indexed and candidate pages
- weight each word by search-demand proxy or editorial priority
- compute how many high-value pages each symbol helps decode

This is more important than pure linguistic typology because the course exists to help users read **your** site.

### 2) Cross-linguistic usefulness
Use PHOIBLE / UPSID-style inventory data as a secondary signal to identify sounds that recur across many languages and are therefore worth teaching early if they also appear in your corpus.

### 3) English-speaker confusion score
Boost symbols that are easy to misread:
- `ə`
- `ɪ`
- `ʊ`
- `æ`
- `ɑ`
- `ɔ`
- `ɒ`
- `ʃ`
- `ʒ`
- `θ`
- `ð`
- `ŋ`
- `ɹ`
- `ʁ`
- `x`
- `ç`
- `y`
- `ø`
- `œ`
- `ɨ`
- `ɯ`
- `ɕ`
- `ʂ`

### 4) Example availability
Prioritize symbols that have:
- short familiar English examples,
- clean audio,
- minimal pairs or near-minimal contrasts,
- useful loanword/proper noun examples later.

### Recommended priority formula
```txt
priority =
  0.45 * site_corpus_coverage +
  0.20 * page_demand_weighted_coverage +
  0.15 * crosslinguistic_utility +
  0.15 * confusion_score +
  0.05 * example_availability
```

This formula should be configurable in a build script so the curriculum can evolve with the corpus.

---

## Required vs extension content

### Required learning set (core track)
This should cover the site's default broad transcription system and the most valuable high-confusion international symbols.

#### Vowels and vowel marks
- `ə` schwa
- `ɪ`
- `ʊ`
- `æ`
- `ɛ`
- `ʌ`
- `ɑ`
- `ɔ`
- `ɒ`
- `i`
- `u`
- `ɚ`
- `ɝ`
- `ɜ` / `ɜː` mapping concept
- diphthongs as sequences: `eɪ`, `aɪ`, `oʊ`, `aʊ`, `ɔɪ`
- `ː` length
- `ˈ` primary stress
- `ˌ` secondary stress

#### English/core consonants
- `ʃ`
- `ʒ`
- `ŋ`
- `tʃ`
- `dʒ`
- `θ`
- `ð`
- `ɹ`
- `j`
- `ɾ`
- `ʔ`

#### High-value international sounds
- `r`
- `ɲ`
- `x`
- `ç`
- `ʁ`
- `y`
- `ø`
- `œ`
- `̃` nasalization
- `ɨ`
- `ɯ`
- `ɕ`
- `ʂ`
- `ʰ`

### Extension set
Teach these only after the core track, or teach them inside optional advanced packs:
- `œ̃`
- `ɑ̃`
- `ɛ̃`
- `ɔ̃`
- `ʎ`
- `ʑ`
- `dʑ`
- `ts`
- `dz`
- `ʈʂ`
- `ʐ`
- `ʲ`
- `̩`
- tone letters / tone-number literacy
- `q`
- `χ`
- `ɦ`
- any highly narrow diacritics not used in your site's house style

### Explicitly omitted from launch
- clicks
- implosives
- ejectives
- extIPA
- pathological-speech notation
- highly narrow diacritic stacks
- niche tone systems beyond basic recognition

---

## House transcription profile for the course

The course should teach the notation conventions the site itself uses. Recommended launch profile:

- broad phonemic transcription, not hyper-narrow phonetics
- stable accent labels (General American, British English, Native/Local, etc.)
- use the same symbol choices across the directory and the course
- surface variant mappings when necessary, for example:
  - British `ɒ` vs American `ɑ`
  - British `ɜː` vs American `ɝ/ɚ`
  - flap `ɾ` as an American realization note, not a separate spelling system
- avoid teaching multiple dictionary traditions at once

In other words: choose one consistent house style and teach that first. Add “other notations you may also see” later.

---

## Lesson architecture

### Step types
Every unit should be built from reusable step types. Suggested types:

1. **TeachSymbol**
   - introduces 1 symbol
   - short plain-English explanation
   - mouth/airflow hint only if useful
   - 2–4 short example words
   - audio button for each example

2. **TeachConcept**
   - introduces one useful concept
   - examples: schwa, stress, fricative, affricate, nasal vowel, aspiration, trill, tap
   - must directly support decoding

3. **DecodeWord**
   - show IPA for a short word
   - learner says or thinks the word
   - presses button to hear correct audio
   - optionally types what they think it is

4. **ListenMatch**
   - play audio
   - choose between 2–4 IPA options
   - good for contrast drilling

5. **BuildWord**
   - choose symbols to assemble a heard or spelled word
   - useful after a symbol cluster is introduced

6. **BonusRound**
   - 4–8 words in sequence
   - minimal commentary
   - tests fluency rather than isolated recognition

7. **ReviewRound**
   - mixed due items from prior symbols/concepts
   - powered by local SRS state

8. **MicCheck**
   - optional
   - record one attempt
   - play back learner audio
   - show approximate confidence/rating if supported

### Golden rule
Each step should do exactly one thing well.

---

## Core gameplay loop

1. Introduce 1–3 new symbols or one concept.
2. Explain them in plain English using short common words.
3. Ask the learner to decode a word or pick the right sound.
4. Let the learner listen immediately.
5. Repeat with enough variety to build pattern recognition.
6. Every few steps, run a bonus round with several words in a row.
7. Run review items from earlier lessons using spaced repetition.
8. Celebrate step completion briefly, then advance.

---

## UI / interaction design

### Layout
Recommended structure:
- top progress bar
- lesson title + micro objective
- main challenge card
- secondary “Need a hint?” drawer
- audio controls row
- answer controls
- small theory note only when needed
- next-step CTA after success

### Tone
- calm
- direct
- non-patronizing
- no mascot dependency
- no gamified dark patterns
- no ad-like interruptions

### Visual behavior
- high-contrast
- large IPA font
- very small amount of color
- motion only for success moments
- respect reduced-motion preferences

### Completion effect
Use a very brief confetti/firework burst:
- duration under ~700ms
- automatically proceed to next step after brief beat
- disable or reduce motion if the OS/browser requests reduced motion

---

## Accessibility requirements

- full keyboard navigation
- focus states always visible
- large tap targets on mobile
- audio controls operable by keyboard and screen readers
- IPA symbols rendered with accessible fallback text where needed
- captions / alt text for symbol names and concept labels
- reduced motion mode disables celebratory animation
- no audio autoplay assumptions before user gesture
- mic features must have clear permission handling and graceful fallback

---

## Spaced repetition and progress model

### Recommendation
Use a **simple deterministic review scheduler in v1** rather than a fully optimized personalized memory model.

Why:
- no accounts
- no backend
- small local state
- predictable and debuggable
- easy to migrate later

### Recommended v1 scheduler
Use an **SM-2-style** or **FSRS-lite** scheduler:
- review rating options hidden behind normal UX outcomes
- map outcomes to simple grades:
  - failed
  - hard
  - good
  - easy
- schedule symbol cards and concept cards, not just whole lessons
- each lesson completion can create/update several card memories

### What gets scheduled
- individual symbols
- symbol contrasts (`ɪ` vs `i`, `θ` vs `ð`, etc.)
- concepts (stress, schwa, nasalization, aspiration)
- high-value example words
- mixed sequences

### Review triggers
- due review queue shown on return visits
- review cards inserted inside the main lesson flow
- periodic checkpoint units contain only mixed review

### Storage model
Store progress locally, not on a server.

Recommended browser storage split:
- `localStorage`: progress, settings, scheduler state, current step pointer, compact symbol stats
- service worker cache / Cache API: app shell, lesson JSON, audio, optional model assets
- do **not** use cookies for progress except as a last-resort fallback

### State schema
```ts
type LearnIpaState = {
  version: number;
  currentStepId: string | null;
  completedStepIds: string[];
  unlockedModuleIds: string[];
  lessonAttempts: Record<string, {
    attempts: number;
    correct: number;
    lastSeenAt: string;
  }>;
  symbolStats: Record<string, {
    introduced: boolean;
    confidence: number; // 0-1
    dueAt: string | null;
    intervalDays: number;
    ease: number;
    lapses: number;
    successes: number;
  }>;
  reviewQueue: string[]; // card ids
  settings: {
    accent: "en-US" | "en-GB";
    reducedMotion: boolean;
    autoplayAfterGesture: boolean;
    micMode: "off" | "record-only" | "experimental-score";
    playbackRateDefault: 1 | 0.5;
  };
  streak: {
    currentDays: number;
    lastStudyDate: string | null;
  };
};
```

### Storage budget
This state must stay tiny. It should comfortably fit in browser local storage.

---

## Performance architecture

### Route strategy
- main word pages remain Worker-rendered/static-first as already planned
- `/learn-ipa` is a client-side app served as static assets from the same Cloudflare deployment
- the learning bundle should be code-split away from normal word pages

### Recommended stack for `/learn-ipa`
Best balance of practicality and weight:
- TypeScript
- Vite
- Preact (or vanilla TS if the team wants zero framework ergonomics tradeoff)
- tiny CSS
- Zod for lesson schema validation
- localStorage for progress
- service worker for offline shell + cached lessons/audio
- `canvas-confetti` for celebration
- feature-flagged mic packages loaded lazily

### Why Preact instead of a heavier SPA
The lesson experience is interactive enough that plain DOM code can become awkward, but the rest of the site should not inherit a large app runtime. Preact gives component ergonomics without turning the entire site into a heavyweight React product.

### Bundle budgets
Recommended launch budgets:
- app shell JS: target under ~70 KB gzipped
- CSS: under ~15 KB gzipped
- one unit JSON: under ~12 KB gzipped
- unit audio payload: ideally under ~250–300 KB on first fetch
- mic scoring code and models: lazy-loaded only after opt-in

### Offline support
The course is a perfect candidate for a service worker:
- cache app shell
- cache current module JSON
- cache next likely module JSON
- cache recent audio clips
- optionally cache selected mic-recognition assets after opt-in

### Important rule
Do not put large model files or audio corpora in `localStorage`. Use the browser cache / service worker and, if needed, IndexedDB or Cache API for larger offline assets.

---

## Audio strategy for the course

### Playback behavior
For lesson audio:
- use the native media stack (`HTMLAudioElement` / `HTMLMediaElement`) for reliability
- preload the current and next clip after the first user gesture
- expose replay at 1x and 0.5x
- remember preferred playback speed locally

### Audio source strategy
1. Reuse existing pronunciation-project audio where possible.
2. Generate short lesson clips at build time when needed.
3. Allow lesson-specific overrides for cleaner pedagogy.
4. Prefer short, familiar word clips before full phrase clips.

### Accent behavior
Recommended launch:
- default to General American for the core track
- allow British mode later or as an alternate track
- international/native variants should appear in dedicated origin modules and capstones

### Lesson-audio data shape
```json
{
  "id": "audio:lesson:u08:ship",
  "src": "/learn-ipa/audio/u08/ship.mp3",
  "text": "ship",
  "ipa": "ʃɪp",
  "accent": "en-US",
  "duration_ms": 720
}
```

---

## Mic / pronunciation-check feature

### Recommendation
Ship this as **experimental**.

### Why
Static, browser-only pronunciation assessment can be helpful, but it will not match a dedicated cloud pronunciation-assessment product in consistency. It should support learning, not claim to be authoritative.

### Launch progression
#### Phase A — safe launch
- record learner audio
- play it back
- no automatic score
- optionally ask learner “Did that sound close?” for self-reflection

#### Phase B — constrained scoring
- opt-in experimental mic mode
- single-word tasks only
- local keyword / constrained-grammar recognition
- approximate score + confidence band
- clear label: “experimental”

#### Phase C — richer scoring
- optional local acoustic similarity scoring
- optional local ASR model
- still clearly non-authoritative

### Preferred technical approach for v1 experimental scoring
Use a **constrained single-word or small-grammar recognition pipeline**, not full open-ended speech recognition.

#### Why this is better
In a lesson, the app usually knows the target answer already:
- `sun`
- `ship`
- `Bach`
- `Xi`
- `Qatar`

That means you do not need a general-purpose dictation engine. You need:
- target-aware validation,
- approximate matching,
- tolerance for accent variation,
- fast local execution.

### Recommended layered scoring pipeline
#### Layer 1: signal sanity checks
- user granted mic permission
- audio level is not silent
- clip duration is within acceptable range
- voice activity detected

#### Layer 2: constrained recognition
Try one of:
- PocketSphinx.js with a tiny grammar / keyword set for the current challenge
- Vosk/Vosklet only if a model is already cached and the footprint is acceptable

This layer returns:
- recognized token(s)
- confidence if available
- whether the target or an allowed variant was recognized

#### Layer 3: acoustic similarity (optional)
For more nuance:
- extract MFCC or related audio features in-browser
- compare learner clip to reference clip using DTW-style sequence comparison
- derive a coarse similarity score

This does **not** mean “phonologically perfect,” but it can distinguish obviously closer vs obviously farther attempts.

#### Layer 4: human-readable feedback
Return simple feedback only:
- “Very close”
- “Close”
- “Try stressing the first syllable”
- “The vowel sounded off”
- “Try the ‘sh’ sound at the start”

Do not overclaim precision.

### Scoring rubric
Suggested display:
- 0–49: “Needs work”
- 50–69: “Close”
- 70–84: “Good”
- 85–100: “Very close”

Internally, weight:
- target recognition / allowed variant match
- rough stress timing
- rough vowel/consonant similarity
- confidence penalty if signal is noisy

### Allowed variants
The scorer must support accepted alternatives. Example:
- English lay pronunciation vs native/local/newsroom form
- US vs UK form
- common anglicized proper noun vs original-language approximation

### Hard rule
Never tell the learner they are “wrong” if the app only has low confidence. Prefer:
- “Not sure — try again”
- “This may still be acceptable in some accents”
- “The app had trouble hearing that clearly”

---

## Lesson-content source model

### Human-authored layer
Use markdown/YAML files for:
- module intros
- concept explanations
- curated example choices
- contributor notes
- exception handling
- cultural/language-origin notes

### Generated layer
Use build-generated JSON for:
- step ordering
- review card objects
- symbol-to-example mappings
- deep-link maps from word pages into lessons
- derived challenge pools

### Recommended file structure
```txt
content/
  ipa/
    modules/
      01-vowel-basics.md
      02-schwa-and-short-vowels.md
      ...
    concepts/
      schwa.md
      stress.md
      fricatives.md
      nasal-vowels.md
      aspiration.md
    packs/
      german-loanwords.md
      chinese-loanwords.md
      french-loanwords.md

data/
  ipa/
    symbols.yaml
    lesson-plan.yaml
    examples.yaml
    challenge-templates.yaml
    generated/
      modules.json
      steps/
      cards/
      link-map.json
```

### Symbol metadata schema
```yaml
- symbol: "ə"
  id: "schwa"
  name: "schwa"
  class: "vowel"
  teach_explicitly: true
  required: true
  prerequisites: []
  concepts:
    - reduced-vowel
  english_examples:
    - about
    - sofa
    - taken
  loanword_examples: []
  notes:
    - Most common reduced vowel in English.
  difficulty: 0.3
  confusion_score: 0.95
```

### Example metadata schema
```yaml
- id: "ex-about"
  word: "about"
  display: "about"
  ipa:
    en-US: "əˈbaʊt"
    en-GB: "əˈbaʊt"
  focus_symbols:
    - "ə"
    - "aʊ"
    - "ˈ"
  familiarity: 0.95
  word_type: "common-word"
  origin_language: "en"
  audio:
    en-US: "/audio/learn/en-US/about.mp3"
  meaning_gloss: "used to introduce a topic or estimate"
```

---

## Automatic curriculum generation

### Unit generator rules
Generate modules/units from the symbol inventory using rules like:
- 2–3 new teachable items max per unit
- at least 1 contrast-heavy practice step
- at least 1 bonus round every 5–6 steps
- at least 1 review insertion per unit after the learner has enough history
- do not introduce visually similar hard symbols in the same step unless contrast is the point

### Example selection rules
For early units:
- prefer 3–5 letter English words
- prefer very high familiarity
- avoid silent-letter orthography lessons
- prefer clean audio and stable broad transcriptions

For later origin-language packs:
- choose recognizable loanwords and proper nouns
- show both English and native/local variants where relevant
- show origin-language labels and social context
- explain when multiple pronunciations are acceptable

### Review-card generation
Generate cards for:
- symbol recognition
- symbol-to-sound
- sound-to-symbol
- word decoding
- mixed sequences
- accent/variant recognition
- origin-language cluster practice

---

## Recommended curriculum sequence (144 steps)

This is the default proposed launch sequence. It is intentionally modular so Codex can generate the lesson JSON from this plan.

### Unit structure
Each 6-step unit follows this default pattern:
1. New symbol / concept A
2. New symbol / concept B
3. New symbol / concept C or contrast concept
4. Guided decoding practice
5. Bonus round
6. Review round

### Unit 01 — Steps 1–6
**Theme:** First wins with familiar short vowels  
**New items:** `æ`, `ɛ`, `ɪ`  
**Examples:** `cat`, `bed`, `sit`, `men`, `pin`  
**Concepts:** one symbol, one sound; why English spelling is unreliable

### Unit 02 — Steps 7–12
**Theme:** More short vowels  
**New items:** `ʌ`, `ə`  
**Examples:** `sun`, `cup`, `about`, `sofa`, `taken`  
**Concepts:** schwa; reduced vowels

### Unit 03 — Steps 13–18
**Theme:** High vs high-ish vowels  
**New items:** `i`, `u`, `ʊ`  
**Examples:** `see`, `food`, `book`, `good`, `blue`  
**Concepts:** tense-ish vs lax-ish practical distinction; do not over-theorize

### Unit 04 — Steps 19–24
**Theme:** Open and back vowels  
**New items:** `ɑ`, `ɔ`  
**Examples:** `father`, `spa`, `law`, `thought`, `caught`  
**Concepts:** broad transcription; accent variation note

### Unit 05 — Steps 25–30
**Theme:** British/US vowel mapping  
**New items:** `ɒ`, `ɜ` + mapping to `ɚ` / `ɝ`  
**Examples:** `lot` (UK), `nurse`, `bird`, `learn`, `word`  
**Concepts:** accent labels; same word can have multiple valid transcriptions

### Unit 06 — Steps 31–36
**Theme:** Diphthongs I  
**New items:** `eɪ`, `aɪ`, `oʊ`  
**Examples:** `say`, `day`, `time`, `ride`, `go`, `home`  
**Concepts:** a diphthong is a moving vowel

### Unit 07 — Steps 37–42
**Theme:** Diphthongs II + marks  
**New items:** `aʊ`, `ɔɪ`, `ː`  
**Examples:** `now`, `mouth`, `boy`, `choice`, long-vowel examples  
**Concepts:** length mark in the site's notation

### Unit 08 — Steps 43–48
**Theme:** English consonants that look unfamiliar  
**New items:** `ʃ`, `tʃ`, `dʒ`  
**Examples:** `ship`, `she`, `chew`, `chip`, `job`, `jam`  
**Concepts:** fricative vs affricate

### Unit 09 — Steps 49–54
**Theme:** More high-value consonants  
**New items:** `ʒ`, `ŋ`, `j`  
**Examples:** `measure`, `vision`, `sing`, `song`, `yes`, `yarn`  
**Concepts:** symbol `j` = English “y” sound in IPA

### Unit 10 — Steps 55–60
**Theme:** The “th” pair and English r  
**New items:** `θ`, `ð`, `ɹ`  
**Examples:** `thin`, `bath`, `this`, `those`, `red`, `right`  
**Concepts:** voiceless vs voiced contrasts in real words

### Unit 11 — Steps 61–66
**Theme:** Stress and syllables  
**New items:** `ˈ`, `ˌ`  
**Examples:** `banana`, `computer`, `linguistics`, `photograph`  
**Concepts:** primary stress, secondary stress, syllable rhythm

### Unit 12 — Steps 67–72
**Theme:** American realizations  
**New items:** `ɾ`, `ʔ`  
**Examples:** `water`, `city`, `button`, `uh-oh`  
**Concepts:** flap, glottal stop, “what you may hear vs what the word page shows”

### Unit 13 — Steps 73–78
**Theme:** Taps, trills, and palatal nasals  
**New items:** `r`, `ɲ`  
**Examples:** Spanish-style `pero`/`perro` style contrasts, `canyon`, `señor`  
**Concepts:** tap vs trill; palatal nasal

### Unit 14 — Steps 79–84
**Theme:** German/French throat sounds  
**New items:** `x`, `ç`, `ʁ`  
**Examples:** `Bach`, `ich`, `rouge`, `Paris` (carefully labeled), `sprachbund`  
**Concepts:** back fricatives; uvular / French-style r

### Unit 15 — Steps 85–90
**Theme:** Front rounded vowels  
**New items:** `y`, `ø`, `œ`  
**Examples:** `lune`, `deux`, `peur`, German/French borrowings  
**Concepts:** rounded vs unrounded vowels; front rounded vowel family

### Unit 16 — Steps 91–96
**Theme:** Nasal vowels  
**New items:** `̃`, `ɑ̃`, `ɛ̃`, `ɔ̃`  
**Examples:** `bon`, `vin`, `blanc`, selected French loanwords/names  
**Concepts:** nasalization; the tilde as a feature mark

### Unit 17 — Steps 97–102
**Theme:** High-value non-English close vowels  
**New items:** `ɨ`, `ɯ`, `ʰ`  
**Examples:** words/names from Turkish, Japanese, Mandarin, Slavic examples  
**Concepts:** aspiration as a mark that matters in many Asian-language transcriptions

### Unit 18 — Steps 103–108
**Theme:** Sibilant families I  
**New items:** `ɕ`, `ʂ`, `ts`  
**Examples:** `Xi`, `shi`, `tsar`, `Qigong`-adjacent examples, curated proper nouns  
**Concepts:** why “sh-like” sounds split into different places of articulation

### Unit 19 — Steps 109–114
**Theme:** Sibilant families II  
**New items:** `tɕ`, `ʈʂ`, `ʐ`  
**Examples:** Chinese and Slavic name/loanword examples  
**Concepts:** affricate families; retroflex vs alveolo-palatal

### Unit 20 — Steps 115–120
**Theme:** Practical diacritics and small marks  
**New items:** `ʲ`, `̩` (optional), tie-bar recognition  
**Examples:** selected Slavic / English syllabic consonant cases  
**Concepts:** only teach these insofar as they appear in site content

### Unit 21 — Steps 121–126
**Theme:** Tone lite (optional advanced required)  
**New items:** `˥`, `˧`, `˩` and/or tone-number literacy  
**Examples:** selected Mandarin names/loanwords  
**Concepts:** recognizing tone notation without turning the course into full tonal phonology

### Unit 22 — Steps 127–132
**Theme:** German and French loanword capstone  
**Focus words:** `sprachbund`, `schadenfreude`, `zeitgeist`, `Bach`, `rouge`, `croissant`, `genre`  
**Concepts:** multiple acceptable English readings vs native-ish forms

### Unit 23 — Steps 133–138
**Theme:** Chinese, Japanese, and Spanish capstone  
**Focus words:** `Xi Jinping`, `Qigong`, `Beijing`, `karaoke`, `tsunami`, `jalapeño`, `piñata`  
**Concepts:** anglicization vs native/local labels

### Unit 24 — Steps 139–144
**Theme:** Final mixed gauntlet  
**Content:** mixed review across all required content  
**Concepts:** decoding transfer to real word pages; “What to do when you see unfamiliar IPA in the wild”

---

## Bonus-round design

Every 5th step or at least once per unit:
- show 4–8 words in sequence
- learner reads them mentally or aloud
- then listens to all answers
- optionally receives a fluency streak score
- use one or two words from prior units, not only the current unit

### Bonus-round modes
- **Sequence mode:** one word after another
- **Contrast mode:** pick the odd one out
- **Speed mode:** decode 5 words under light time pressure
- **Name mode:** proper nouns only
- **Origin mode:** all words from one donor language

---

## Review design

### Review injections
- Step 6 of most units = review-heavy
- every 4 units = checkpoint review block
- returning users see a “Due for review” CTA before continuing

### Review mix recommendation
- 50% due items
- 30% recent items
- 20% confidence-building easy wins

### Review content types
- symbol recall
- symbol contrast
- decode word
- identify stress
- match audio to IPA
- optional mic attempt

---

## Integration with the main pronunciation directory

This is one of the highest-leverage additions.

### On each word page
Add:
- `Learn these symbols` chips generated from the word's IPA
- deep links into the relevant `/learn-ipa` steps or modules
- a mini note like:
  - “You’ve learned 4 of the 6 symbols in this word”
  - “New here? Learn `x` and `ʁ` first”

### On lesson steps
Add:
- `Words using this symbol` links
- `More words from German/French/Chinese` links
- `See it on real pages` links back into the main directory

### Why this matters
The learning module is not separate from the directory. It turns every pronunciation page into:
- a possible motivation to learn IPA,
- a contextual review opportunity,
- an internal-link hub that is actually helpful.

---

## Contributor workflow for the course

### Who should be able to contribute
- English editors
- native speakers / domain experts for origin-language packs
- linguistics-minded contributors
- pronunciation enthusiasts improving examples and notes

### Contribution surfaces
- lesson copy
- symbol notes
- example selection
- origin-language packs
- variant-acceptance lists for mic scoring
- audio overrides
- pronunciation caveats

### Review flags
```yaml
review:
  status: auto-generated | human-edited | native-reviewed | editor-approved
  language_origin_checked: true
  audio_checked: true
  pedagogy_checked: true
```

---

## Deployment and Cloudflare implications

### Why this fits the existing architecture
The learning module is:
- one SPA route
- a handful of static assets
- some generated JSON
- lesson audio
- optional lazy-loaded mic modules

That is far easier on Cloudflare than turning 144 steps into 144 static pages.

### Static-asset strategy
Recommended:
- app shell in Workers static assets
- lesson JSON in static assets or small shards
- audio clips in static assets or R2 if the set grows
- optional mic model files in R2 or a dedicated asset path, lazy-loaded only after opt-in

### Route behavior
- `/learn-ipa` served from static assets
- the Worker still handles normal SSR word pages
- no relational database needed
- no write path needed beyond browser storage

---

## Mic-model strategy

### Launch-default implementation
- `record-only` mode available everywhere supported
- `experimental-score` hidden behind feature flag / settings toggle

### Preferred libraries / options
#### Primary lightweight candidate for constrained tasks
- PocketSphinx.js
  - runs entirely in browser
  - supports Web Workers
  - has keyword spotting / constrained setups
  - better fit for single-word validation than full dictation

#### More contemporary experimental candidate
- Vosklet / Vosk in browser
  - useful for larger vocabulary / multilingual experiments
  - heavier because model size dominates
  - should be opt-in, lazy-loaded, and possibly restricted to desktop first

#### Acoustic similarity helper
- Meyda (or equivalent) for in-browser feature extraction
- DTW-style comparison inside a Web Worker

### Launch recommendation
Implement in this order:
1. record + playback
2. PocketSphinx.js constrained single-word scoring for selected lessons
3. optional acoustic similarity refinement
4. explore Vosklet only if worth the payload

---

## Privacy / permissions

- mic permission only requested when the user explicitly enters mic mode
- clear notice: audio stays local unless the app is using a browser feature that may rely on server recognition
- default mode should avoid browser speech APIs that may send audio off-device
- always provide a no-mic path through the course

---

## Acceptance criteria

### Functional
- `/learn-ipa` route exists and is accessible from homepage and navbar
- local progress persists across refreshes and later sessions
- core curriculum is generated from files, not hardcoded into components
- bonus rounds appear regularly
- review rounds appear regularly
- confetti / firework effect appears on completion and respects reduced motion
- word pages can link into relevant lessons
- lessons can link back into real word pages
- audio plays at 1x and 0.5x
- mic mode is optional and non-blocking

### Performance
- first lesson usable quickly on mobile
- mic libraries are not in the initial bundle
- the app remains responsive during review and audio playback
- heavy audio analysis runs off the main thread where feasible

### Content
- required symbol set is covered
- every explicit symbol has at least 5 total practice exposures before the final capstone
- every unit includes real words, not only isolated sounds
- language-origin capstones include both loanwords and proper nouns

### SEO
- only overview-level learn pages are indexable
- step states are not thin indexed pages
- canonical handling is correct

---

## Suggested PR / implementation breakdown

### PR 1 — Route and app shell
- add `/learn-ipa`
- add homepage CTA + navbar link
- add minimal app shell with progress bar and routing
- add local state scaffolding
- add reduced-motion-safe confetti

### PR 2 — Content pipeline
- add `symbols.yaml`, `lesson-plan.yaml`, `examples.yaml`
- add generator that produces module/step JSON
- add validation tests
- add 4 pilot units

### PR 3 — Core lesson engine
- implement step renderer
- implement TeachSymbol / DecodeWord / ListenMatch / BonusRound / ReviewRound
- implement native audio controls
- preload next audio clips

### PR 4 — Review scheduler
- add SM-2/FSRS-lite local scheduler
- add review queue
- add checkpoint blocks
- add progress summary

### PR 5 — Main-site integration
- add `Learn these symbols` chips on word pages
- add symbol-to-lesson link map
- add “words using this symbol” inside lessons

### PR 6 — Advanced units and origin packs
- add German/French/Chinese/Japanese/Spanish packs
- add capstone units
- add accent/variant lesson content

### PR 7 — Offline support
- add service worker
- cache shell, recent lessons, recent audio
- add versioned cache invalidation

### PR 8 — Experimental mic mode
- add record/playback
- add feature flag
- add constrained local scoring for a subset of lessons
- add clear confidence/fallback messaging

---

## Test plan

### Unit tests
- curriculum generation order
- prerequisite graph validity
- no missing symbol definitions
- no orphan examples
- review scheduler transitions
- localStorage migration logic
- deep-link generation from word-page IPA tokens

### Integration tests
- lesson navigation
- answer flow
- review flow
- audio control behavior
- reduced-motion confetti disable
- returning user resume flow

### Manual QA
- mobile Safari
- Chrome desktop
- Firefox desktop
- low-end Android
- microphone permission denied
- microphone unavailable
- reduced motion enabled
- empty localStorage
- stale localStorage schema upgrade

---

## Open product questions

1. Should tone literacy be part of the core required track or the optional advanced track?
2. Should the default course use only American English examples, or should the learner choose American vs British at onboarding?
3. Should proper-noun modules teach “native/preferred” before “common English media pronunciation,” or always show both together?
4. Should some individual lesson modules be indexable as standalone guides, or should only `/learn-ipa` and `/learn-ipa/reference` be indexable?
5. How strict should the app be about allowing multiple acceptable variants in mic mode?
6. Do you want the course to teach only the site's house transcription profile, or also show “other notations you may see” side notes from launch?

---

## Codex implementation prompt addendum

Use the following as the next prompt to Codex after the main pronunciation-directory PRD.

```txt
You are working inside the existing Cloudflare pronunciation-directory project.

Your task is to add a new `/learn-ipa` experience to the same project.

High-level product goal:
Build a freeCodeCamp-style interactive IPA course for English speakers that teaches the subset of IPA needed for the site's pronunciation pages and for major European and Asian loanwords/proper nouns. The experience must be static/client-side, require no server database, and persist progress locally in the browser.

Hard constraints:
- Deployable to Cloudflare in the existing project.
- No relational database, no server-side user state, no auth.
- Track progress in localStorage only.
- Use service worker/cache for app shell, lesson JSON, and audio as needed.
- Keep the initial bundle lightweight.
- Do not make microphone scoring a launch blocker.
- The mic feature must be optional and experimental.
- Deep lesson step routes must not become thin indexable pages.

Implementation preferences:
- TypeScript.
- Vite + Preact for the `/learn-ipa` app only, unless you can achieve the same developer ergonomics with smaller/cleaner vanilla TS.
- Zod for schema validation.
- Tiny CSS.
- Native audio controls via HTMLMediaElement or a thin custom wrapper around it.
- Use canvas-confetti or similarly lightweight celebratory effect, respecting reduced-motion preferences.
- Lazy-load all mic-related code.
- Keep word pages server-rendered/static-first as they are; `/learn-ipa` is the SPA route.

Content/data requirements:
- Do not hardcode lesson content in components.
- Create file-based content sources:
  - `data/ipa/symbols.yaml`
  - `data/ipa/examples.yaml`
  - `data/ipa/lesson-plan.yaml`
  - `content/ipa/modules/*.md`
  - `content/ipa/concepts/*.md`
- Write a generator script that compiles these into runtime JSON.
- The generator must support:
  - prerequisites
  - required vs optional symbols
  - challenge type assignment
  - review-card generation
  - deep-link map from word-page IPA tokens to lesson ids

Curriculum requirements:
- Implement the default 144-step sequence from the PRD addendum.
- Teach only a few symbols at a time.
- Use short familiar English words early.
- Insert bonus rounds regularly.
- Insert review rounds regularly.
- Include origin-language capstones for German, French, Chinese/Japanese, and Spanish.
- Teach the site's house transcription system, not every possible IPA convention.

Must-have features:
1. `/learn-ipa` landing page with CTA, progress resume, module list, and explanation of what IPA is.
2. Lesson engine supporting:
   - TeachSymbol
   - TeachConcept
   - DecodeWord
   - ListenMatch
   - BonusRound
   - ReviewRound
   - optional MicCheck stub
3. Local progress persistence with versioned migrations.
4. Simple deterministic spaced repetition scheduler (SM-2-style or FSRS-lite defaults only; no backend optimizer).
5. Audio playback controls at 1x and 0.5x.
6. Reduced-motion-safe success effect before auto-advancing.
7. Deep integration with pronunciation pages:
   - generate “Learn these symbols” links
   - link lessons back to real word pages using those symbols
8. Service worker for offline-friendly shell and recently used lesson assets.
9. SEO handling:
   - `/learn-ipa` indexable
   - step routes canonicalized or noindexed appropriately
10. Accessibility:
   - keyboard-friendly
   - visible focus states
   - mobile-friendly
   - no mic requirement
   - reduced-motion support

Mic feature requirements:
- Phase 1: record and playback only.
- Phase 2: feature-flagged experimental local scoring on selected single-word lessons.
- Prefer constrained local recognition, not open dictation.
- If implementing speech recognition:
  - prefer browser-local / offline-capable approaches where practical
  - do not rely on Web Speech API as the only implementation
  - gracefully handle unsupported browsers
- If you implement acoustic similarity, run heavy work in a Web Worker.

Performance requirements:
- keep `/learn-ipa` bundle separate from normal word pages
- lazy-load later modules where practical
- lazy-load mic packages/models only after opt-in
- avoid shipping large model files in the initial app shell
- keep runtime responsive during audio and review flows

Deliverables:
- working `/learn-ipa` app
- generator script and schemas
- starter content files
- at least 12 fully working units plus scaffolding for the rest if time-constrained
- integration with word pages
- tests for generator, scheduler, and local-state migration
- clear README section documenting how to add or edit lessons/symbols/examples

Important design guidance:
- Make the learning experience feel calm, obvious, and addictive in the good sense.
- Avoid framework sprawl.
- Avoid hardcoded lesson JSX.
- Avoid creating SEO-thin pages.
- Favor deterministic, maintainable code over cleverness.
- Favor quality of the core loop over breadth of mic scoring.

When making tradeoffs:
1. protect performance,
2. protect clarity,
3. protect maintainability,
4. protect deployability on Cloudflare,
5. keep the course genuinely useful to humans, not just “present”.

Start by:
- proposing the file structure changes,
- implementing schemas and generator,
- scaffolding the SPA route,
- wiring local state,
- rendering the first pilot units,
- then iterating toward review, deep links, and service worker.
```

---

## Recommended research/data notes to preserve in the repo

Keep a `/docs/research/learn-ipa-sources.md` file summarizing:
- IPA chart / house-style decisions
- corpus-derived symbol frequency method
- PHOIBLE/UPSID usage notes for priority weighting
- Wiktextract / CMUdict / ipa-dict / WordNet data provenance
- why step routes are not indexed
- why mic scoring is labeled experimental

This helps future contributors understand why the course is shaped this way.

---
