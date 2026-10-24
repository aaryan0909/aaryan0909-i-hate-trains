# I Hate Trains: Grok Collaboration Setup (GitHub as shared space)

For Grok. Read this first, then start working. Last updated 2026-10-24.

## Grok's two questions, answered

- **GitHub repo:** https://github.com/aaryan0909/aaryan0909-i-hate-trains (public; `main` auto-deploys to Vercel)
- **What the app does, in two sentences:** I Hate Trains is a free companion for people who get scared on trains. It gives a panicking rider immediate help (breathing, grounding, a voice-led rescue), a calm ride mode with stop countdowns, and a pet companion that guides them through it, with the core panic tools working even with no signal.

## How we talk (the honest version)

Adam and Grok cannot message each other directly. GitHub is the shared space, and it works like this:

1. **Grok reads:** everything below lives in the public repo, so Grok can read it any time without the owner pasting files.
2. **Grok writes:** Grok drafts issue specs, feature specs, competitor research, pricing models, and reviews as complete text. Grok cannot post these to GitHub from its chat window, so the owner pastes them to Adam, and Adam opens the GitHub issues and pull requests.
3. **Adam builds:** Adam implements, tests, verifies on production, and deploys. Adam owns production verification: every deploy is checked by fetching the live URL and confirming version markers and file bytes.
4. **Grok reviews:** Grok reads the public repo (commits, PR diffs, issue threads) and reviews. Reviews come back through the owner to Adam.
5. **Turn-taking:** never have both agents editing the same file at the same time. Grok drafts, Adam integrates, Grok reviews the integrated result. Disagreement is welcome and must be stated with reasons.

## Links to everything

### The app itself
- Live app: https://i-hate-trains-aaryan0909s-projects.vercel.app (this URL never changes; updates must never create a new link)
- Repo: https://github.com/aaryan0909/aaryan0909-i-hate-trains
- Owner's portfolio (the app is card 06): https://v0-aaryan-chawla-manifesto.vercel.app

### Read these first (all in this repo, under docs/)
- `docs/HANDOVER.md` — cold-start document: mission, non-negotiable laws, current feature inventory, architecture file map, known gaps, working rules, access checklist, first tasks.
- `docs/REDESIGN_SPEC.md` — the redesign: v1 less-is-more minimalism audit (screen-by-screen cut/hide/shrink), pet-as-companion technical design, start screen spec, desktop phone-frame preview, and v2 online-enabled end-to-end journey (offline floor, online ceiling, ranked online features led by live world-metro transit data).
- `docs/AUDIT_LAYER2.md` — second-layer anxiety-first audit: every feature rated HELPS / WEAK / HURTS against a panicking rider's reality, distraction science, 20 holes the first spec missed, interaction-level audit, ranked cut/fix list, and four explicit disagreements with the first spec.
- `docs/GROK_BRIEF.md` — the original short starter pack (roles, 7-day plan, monetization status).

### Code map (web app, vanilla HTML/CSS/JS, zero dependencies, ~330KB)
- `index.html` — all screens as sections, routing by data attributes.
- `app.js` — the application: state, navigation, breathing engine, toolkit, ride flow, pet, storage, update prompt.
- `styles.css` — design system, including the crafted icon-card visual language (keep it consistent across screens; do not standardize it away).
- `sw.js` — service worker. Network-first for navigations and core assets, calm in-app update prompt on safe screens only. Bump the cache version on every content change.
- `crisis.js` — locale-aware crisis resources (real numbers only, findahelpline.org fallback).
- `guide.js` — contextual coach marks; `drift.js` — synthesized generative ambient audio; `trimap.js` + `ttc.json` — TTC map and the only real transit dataset in the app; `stopheads.js` — spoken stop alerts.
- Storage is localStorage, on-device only, no accounts, no analytics, no tracking. A storage migration layer exists; extend it, never break existing keys, and test upgrades from older versions explicitly.

### Native track (separate, ask the owner for the source)
- An Expo / React Native / TypeScript codebase exists (built by Manus, Oct 2026), offline-first, no backend, no tracking, with tests. Owner holds `I-Hate-Trains-mobile-source.zip`. Never signed, never TestFlighted, never submitted. It contains a disabled RevenueCat scaffold: obsolete, do not revive it.
- App Store path needs an Apple Developer account (does not exist yet), signing, TestFlight to the owner and his girlfriend first, then submission as a free app. Any store step needs the owner's explicit approval per step.

## The laws (non-negotiable)

1. Core panic features work offline, always: panic screen, breathing, grounding toolkit, crisis numbers, backup plan, profile, history, bundled calm content, start screen, manual ride flow. Everything else may use the network and must degrade gracefully. No spinners on a panic screen, ever.
2. Panic and crisis flows are sacred: calm, minimal, zero jokes. Humour only on brand surfaces, roasts the commute, never the rider.
3. Pet zero-maintenance rule: no hunger, no sadness, no death, no guilt. Ever.
4. Clinical honesty: coping tools, not treatment. No cure claims. Stop-if-difficult guidance on breathing. Crisis numbers real and locale-correct, never invented.
5. No invented users, metrics, or test results. Only claim what was actually tested.
6. The owner's girlfriend's installed copy must survive every update with her setup intact. Highest-bar acceptance test.
7. Never send, publish, submit, or purchase anything on the owner's behalf without his explicit approval for that step.

## Division of labor

- **Grok owns:** product thinking, business and monetization research (competitor analysis, pricing models: subscriptions vs freemium vs one-time, launch plans), review of Adam's work (read PR diffs, file review notes as issue comments via the owner), and the faceless growth plan (short-form content using screen recordings only, no face, no owner voice unless he approves it).
- **Adam owns:** building, testing, integration, deployment, production verification, and the repo's docs.
- **Owner owns:** all final decisions, all approvals, and the courier job between Grok and Adam until a better bridge exists.

## Issue and PR conventions (so the loop stays readable)

- Issues: title prefixed by area, e.g. `[pet]`, `[panic]`, `[transit]`, `[growth]`, `[qa]`. Body: problem in one paragraph, proposed change, acceptance criteria (how anyone can verify it), and offline behavior (what happens with no signal).
- PRs: one change per PR, descriptive title, test notes stating exactly what was verified and how. No PR merges without Adam's production verification.
- Reviews: quote the exact lines or behavior, say what is wrong and what would fix it. "Looks good" without reading the diff is not a review.

## Monetization status (unresolved, do not assume)

On 2026-10-05 the owner decided this is not a business: free forever, no premium, no paywall, no ads. On 2026-10-20 and 2026-10-24 he raised making money from it and being a faceless creator who earns from it. Until he confirms a change in plain words, build nothing revenue-related. If he reverses it, the starting position is: panic and crisis tools stay free under any model, and any sponsored placement must be clearly disclosed.

## Current build (in progress, owner-approved 2026-10-24)

Adam is building the redesign from `docs/REDESIGN_SPEC.md` and `docs/AUDIT_LAYER2.md`, in this order: phone-frame preview, minimalism pass (home, panic, breathe first), pet engine (real breath sync, gaze, reactions), start screen, freeze auto-start rescue, then audit fixes. Defaults the owner has not overridden: cuts follow the audit (cognitive tools and cute redirects out of panic paths; backup plan stays as a one-line reminder on the panic screen; onboarding asks city first, name optional; start screen gets a frequency cap after week one; panic layout frozen permanently); motif feeling calm and warm; no accounts (anonymous); trip sharing opt-in contacts only; no revenue mechanics until the owner decides. Grok's highest-value review targets right now: the pet engine spec, the panic-path cuts, and the 7-day launch plan.

## First tasks for Grok

1. Read `docs/HANDOVER.md`, `docs/REDESIGN_SPEC.md`, and `docs/AUDIT_LAYER2.md` in that order.
2. Open (via the owner) three issues: (a) competitor and pricing research for transit-anxiety and calm apps, with a recommended model that keeps panic tools free; (b) a faceless 30-day content plan for launch week and beyond; (c) a review of the pet engine spec, with anything you would change and why.
3. Do not write production code until you have read the three docs above.
