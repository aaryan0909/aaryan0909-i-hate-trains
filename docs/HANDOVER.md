# I Hate Trains: Handover Pack

Cold-start document for the next engineer or coding agent taking this app to production level. Read this fully before touching code. Written 2026-10-20, current live version v27.

## 1. What this is

A free companion app for people who get scared on trains. It began with one real user: the owner's girlfriend, who has panic attacks riding the Toronto TTC alone. Every decision is measured against one question: does this help a frightened rider feel safer during the ride?

- Live: https://i-hate-trains-aaryan0909s-projects.vercel.app
- Repo: https://github.com/aaryan0909/aaryan0909-i-hate-trains (this repo, `main` auto-deploys to Vercel)
- Owner: Aaryan Chawla, Toronto. Product-minded, not an engineer. He gives direction and tests on his iPhone. His girlfriend (Divankshi) is the primary real-world tester. Her installed copy must never break or lose its setup in an update. Treat that as the highest-bar acceptance test.

## 2. The laws (non-negotiable, do not relitigate)

1. **Offline-first, worldwide.** After install, the core panic and ride support must work with zero connectivity: no backend calls, no live APIs, no GPS dependency, no streaming. A spinner or a half-loaded panic screen is a product failure, not a bug.
2. **Panic-first.** Entry leads with a prominent "I need help right now" path. Crisis, breathing, grounding, and emergency flows are sacred: calm, minimal, zero jokes. Humour may exist on brand surfaces only, and it roasts the commute, never the rider.
3. **Rootd for use, Stoic for feel.** Panic-first utility, dark calm visuals, low cognitive load, one-handed use on a shaking train.
4. **Clinical honesty.** These are coping tools, not treatment. No cure claims, no outcome promises. Breathing tools carry stop-if-difficult guidance. Medication copy is reminders for prescribed medication only. Crisis resources must be real and locale-correct (see section 5).
5. **The pet rule.** The co-rider pet (default: Mochi, user-chosen species and name, both respected everywhere) is zero-maintenance: no hunger meters, no sadness, no death, no guilt mechanics. Ever.
6. **Quality bar.** The owner's standard is "App of the Year," his words: "Ferrari, not Hyundai." Fewer features, each the best version of itself. Experiential and interactive over reading screens.
7. **Free.** See section 8 before building anything revenue-related.

## 3. Where it stands

Web PWA at v27 (Oct 2026). Vanilla HTML/CSS/JS, zero dependencies, no build step, no backend. Total payload roughly 330KB. Feature inventory (all shipped and verified on production):

- Panic screen with breathing, grounding (5-4-3-2-1 and variants), comfort, and a voice-led rescue mode ("Talk me through it," v27: near-black eyes-free flow, pet breathes in sync, scripted acceptance then breaths then grounding, one "I'm steadier" exit).
- Breathing engine: multiple patterns, Web Audio phase cues, optional spoken voice-over ("A calm voice," opt-in; the chosen pet is the visual guide and visibly breathes in sync).
- Toolkit of interactive coping tools (touch and gesture based, iOS-safe: no text-selection hijacking on press-and-hold).
- Ride mode: check-in, pre-ride plan, manual stop countdown, "Your stop, out loud" spoken alerts (v26, opt-in), reflection after the ride.
- Comfort: one-tap cute-content redirects (YouTube default, works without login; TikTok and Instagram optional with honest labels) plus bundled offline calm content.
- Pet system: chosen pet and name respected across home, ride, comfort, reflection, breathing.
- Crisis line: locale-aware since v24. Verified local numbers where confirmed, findahelpline.org fallback elsewhere. Never invent a number.
- "Call my person" (v25): user saves a name and number on-device only; shown first on the reach-out screen.
- In-app calm update prompt, storage migration that preserves existing user setup, export/import of user data.
- City themes: 5 hand-made themes. Real transit data: TTC only (TriMap chooser with bundled SVG map and station data, `trimap.js` + `ttc.json`).

Version history lives in `CHANGELOG.md`. Note: `README.md` is stale (describes v4). Updating it is a good first task.

## 4. Architecture (web app)

Plain files, no framework:

- `index.html` (47KB): all screens as sections, screen routing by data attributes.
- `app.js` (128KB): the application. State, navigation, breathing engine, toolkit, ride flow, pet, storage.
- `styles.css` (53KB): the design system, including the crafted icon-card visual language (the owner cares deeply that this language stays consistent across every screen; do not standardize it away into generic cards).
- `sw.js`: service worker, network-first with an in-app update prompt. Bump the cache version on every content change or installed phones keep stale copies.
- `crisis.js`: locale-aware crisis resources.
- `guide.js`: contextual coach marks (in-context, game-tutorial style, not a slideshow).
- `drift.js`: original generative ambient audio ("Drift"). No audio files, all synthesized. Offline-safe.
- `trimap.js` + `ttc.json`: TTC map and data. The only real transit dataset in the app.
- `stopheads.js`: spoken stop announcements (v26).

Storage: localStorage, on-device only, no accounts, no analytics, no tracking. A storage migration layer exists; extend it, never break existing keys, and test upgrades from older versions explicitly.

Deploy: push to `main`, Vercel auto-deploys. Verify production yourself after every deploy (fetch the live URL, check version markers and file bytes). A green CI run or a "done" report is not verification. Every shipped update gets reported to the owner with the live link.

## 5. Known gaps, in priority order

### Gap 1: World metros (the big one)

The owner rode transit all over Italy in Oct 2026 (Rome, Milan, Florence, Naples all have systems) and the app had nothing for any of them. Today: 5 city themes, real data for TTC only, everything else is manual entry. Required end state:

- On ride setup, detect the rider's city from geolocation (with permission; manual entry always available and never blocked).
- Recognize any city with a metro/subway system and switch theme, line names, and stop data automatically.
- Suggested approach: a GTFS ingestion pipeline. Bundle or lazily cache per-city data on-device so the offline law holds. Suggested build order: Toronto (done), London, New York, Paris, Tokyo, Mumbai, then top systems by ridership (the Italian systems early: the owner will test there first emotionally, if not physically).
- Geolocation failure states must stay distinct and honest: permission denied (with OS settings guidance), no fix, timeout/underground. Never blame the user.

Acceptance: a rider landing in a new metro city opens the app and gets their system without typing anything, and everything still works in a tunnel with airplane mode on.

### Gap 2: Testing

Current testing is static checks plus DOM-stub harnesses run by the previous agent (47 checks green at v13, more since). There is no CI, no automated browser test suite, and no real-device lab coverage. Needed:

- CI on the repo (syntax, link/ID integrity, service worker precache consistency).
- A real-device QA pass: current iPhone Safari first (the testers' phones), then Android Chrome. Dead-button and navigation audit across every screen, first-launch and returning-launch, storage upgrade from old versions, reduced motion, largest text size, offline mid-session toggles.
- Regression rule: breathing, panic, and crisis flows get tested on every release, on a physical phone.

### Gap 3: Native app

A full Expo / React Native / TypeScript codebase exists (built by Manus, Oct 2026): offline-first, no backend, no tracking, includes the coping library, planning, reflection, crisis resources, and Vitest tests. Owner holds a copy; ask him for the source zip (`I-Hate-Trains-mobile-source.zip`). It has never been built or shipped:

- No signed iOS build, no physical-device test, no TestFlight, no App Store submission.
- It contains a disabled RevenueCat scaffold. Obsolete: do not revive it (section 8).
- Why native matters: real haptics (iOS Safari has no Vibration API, so the web app cannot vibrate an iPhone), App Store discoverability, stronger offline guarantees.

Path: Apple Developer account ($99/yr, owner must create it), signing, TestFlight to the owner and Divankshi first, then App Store as a free app. Any store submission step needs the owner's explicit approval per step.

## 6. Working rules

- Never send, publish, submit, or purchase anything on the owner's behalf without his explicit approval for that step.
- The owner cannot always see approval prompts on iOS. State any needed approval in plain words in chat.
- Verify on production, report only what you actually tested. Never invent users, metrics, or test results.
- Keep every screen phone-first and one-hand friendly. Touch targets generous, motion gentle, reduced-motion respected.
- If you change storage shape, write the migration and test an upgrade from the previous live version before shipping.

## 7. First tasks (suggested order)

1. Read this doc, `CHANGELOG.md`, and the repo README. Fix the README's version staleness.
2. Stand up CI with the checks in Gap 2.
3. Spec and prototype the GTFS pipeline for one new city end to end (London suggested). Prove the offline bundle size stays sane before scaling to more cities.
4. Real-device QA pass on the current web build; file every dead button and dead end you find.
5. Native: get the Expo source building and onto one physical iPhone via TestFlight.

## 8. Monetization: unresolved, read carefully

On 2026-10-05 the owner decided, after real deliberation: this is not a business. No premium tier, no paywall, no ads, free forever. On 2026-10-20 he raised making it "a truly real project + monetizable idea" while discussing this handover. Those two instructions conflict and the owner has not yet resolved them.

Until he confirms a change in plain words: build nothing revenue-related. If he does reopen it, the lines he drew then still stand as the starting position: crisis and panic tools stay free under any model, sponsored placements (a parked creator-placement idea) must be clearly disclosed, and no ads inside the app.

## 9. Access the owner needs to hand you

- GitHub: collaborator access to `aaryan0909/aaryan0909-i-hate-trains` (and the Manus native source zip).
- Vercel: project `i-hate-trains` (team `aaryan0909s-projects`).
- Apple Developer account (does not exist yet) for the native track.
- This document plus `CHANGELOG.md` are the continuity. The owner's longer product notes (goal spec, improvement plan, rider feedback log) live in his workspace, not this repo; ask him for exports if you need them.

## 10. The one-sentence brief

Make a frightened rider in any metro on Earth, underground with no signal, feel safer within ten seconds of opening this app, and never make them pay, wait, or read a spinner for it.
