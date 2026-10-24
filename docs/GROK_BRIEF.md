# Grok Team Starter Pack: I Hate Trains

Paste this whole document into Grok (grok.com or the X app) as your first message. It gives Grok everything it needs to spin up its own team and collaborate with Muse (Adam) on this app. Last updated 2026-10-24.

## The app in one paragraph

I Hate Trains is a free companion app for people who get scared on trains. It started with one real user: the owner's girlfriend, who has panic attacks riding the Toronto TTC alone. Live at https://i-hate-trains-aaryan0909s-projects.vercel.app. Repo: https://github.com/aaryan0909/aaryan0909-i-hate-trains (main auto-deploys to Vercel). Web app, vanilla HTML/CSS/JS, zero dependencies, about 330KB. Current live version: v30, with a redesign underway.

## The laws (do not break these)

1. Core panic features must work offline: panic screen, breathing, grounding toolkit, crisis numbers, backup plan, profile, history, bundled calm content, start screen, manual ride flow. Everything else may use the network and must degrade gracefully (no spinners, ever, on a panic screen).
2. Panic and crisis flows are sacred: calm, minimal, zero jokes. Humour only on brand surfaces, and it roasts the commute, never the rider.
3. The pet companion (default Mochi, user-chosen species and name) is zero-maintenance: no hunger, no sadness, no death, no guilt. Ever.
4. Clinical honesty: coping tools, not treatment. No cure claims. Breathing tools carry stop-if-difficult guidance. Crisis numbers must be real and locale-correct. Never invent one.
5. No invented users, metrics, or test results. Only claim what was actually tested.
6. The owner's girlfriend's installed copy must survive every update with her setup intact. That is the highest-bar acceptance test.

## Where the project stands

- v30 live: home screen, panic screen, breathing engine with pet guide and voice, interactive grounding toolkit, ride mode with manual stop countdown and spoken stop alerts, comfort redirects, reflection and history, locale-aware crisis line, "Call my person", a Learn tab of cited calm reads, and a "What has helped you" card.
- Redesign in progress (owner-directed, Oct 24): the app got overcrowded after 8 straight additive versions. Direction is less-is-more minimalism, the pet as the actual guide and companion (alive, 3D-feeling, truly breathing with the user, leading every screen), a short hummable start screen on every open, a laptop phone-frame preview, and an end-to-end ideal user journey. A second anxiety-first audit is checking whether every feature truly helps a panicking person.
- Key documents (ask the owner for these files if he has not pasted them): HANDOVER.md (cold-start doc, in the repo), REDESIGN_SPEC.md (v1 minimalism/pet/start screen + v2 online-enabled journey), AUDIT_LAYER2.md (anxiety-first audit, in progress).
- Known gaps, in order: (1) world metros: only TTC has real transit data; the owner wants auto-detection of any city with a subway, starting with the Italian systems (Rome, Milan, Naples, Turin); (2) testing: no CI, no real-device lab; (3) native app: an Expo/React Native codebase exists but has never been signed, TestFlighted, or submitted.

## The team to spin up inside Grok

Run these as distinct roles with distinct deliverables. Do not blur them into one generic assistant:

1. **Design lead.** Owns the less-is-more pass and the pet-as-companion system. Deliverable: screen-by-screen cut/hide/shrink decisions and the pet behavior spec (breath sync, gaze, reactions).
2. **Engineer.** Owns implementation in the existing vanilla codebase. Deliverable: complete, paste-ready file changes (full files, not diffs), each with a test note stating exactly what was verified and how.
3. **QA lead.** Owns the anxiety-first audit mindset. Deliverable: a test matrix (first launch, returning launch, mid-panic, offline, network drop, reduced motion, largest text, one-handed) plus a dead-button and dead-end report for every screen.
4. **Growth lead (faceless).** Owns distribution without the owner's face or name on camera. Deliverable: a 30-day short-form content plan (transit anxiety tips, app demos with screen recordings only, no face, no voice or a voiceover) and a launch checklist for day 7.

## How Grok and Muse collaborate (read this carefully)

- There is no direct connection between Grok and Muse. The owner is the bridge. Single source of truth: the GitHub repo, main branch.
- Grok produces work as complete files or clearly marked code blocks. The owner pastes them to Muse.
- Muse verifies, tests, integrates, and deploys. Muse owns production verification (it fetches the live URL and checks version markers and file bytes). Nothing Grok writes goes live without Muse verifying it first.
- Never have both agents editing the same file at the same time. Work in turns: Grok drafts, Muse integrates, then Grok reviews the integrated result.
- If Grok disagrees with Muse's spec or audit, say so plainly with reasons. Disagreement is useful. Silent agreement is not.

## The 7-day launch plan (web-first, honest)

- Day 1: owner locks the redesign decisions (how aggressive the cuts are, motif feeling, accounts vs anonymous sync, trip-sharing scope, and the monetization decision below).
- Days 2-4: build. Phone frame, minimalism pass on home and panic, pet engine, start screen. The live transit layer for world metros is the biggest item and may slip past day 7; if it does, launch with the redesigned app plus manual ride flow and ship live data as the first post-launch update.
- Day 5: real-device QA on the owner's iPhone and his girlfriend's phone. No launch without this.
- Day 6: launch assets (store-style landing copy, demo video from screen recordings, faceless social posts).
- Day 7: public web launch at the same URL (never a new link). App Store submission is a separate track that runs after, not inside, the 7 days: it needs an Apple Developer account, signing, TestFlight, and Apple review, which alone can take days.

## The monetization decision (owner must make this)

On 2026-10-05 the owner decided this is not a business: free forever, no premium, no paywall, no ads. On 2026-10-20 and again on 2026-10-24 he raised making money from it. Until he confirms a change in plain words, build nothing revenue-related. If he reverses the decision, the starting position is: panic and crisis tools stay free under any model, and any sponsored placement must be clearly disclosed. The "faceless creator who gets money" goal needs a model choice first (supporter tips, optional supporter tier, creator placements, or something else) and a distribution channel second; neither exists yet, and neither appears in 7 days on its own. A launch in 7 days is realistic. Income in 7 days is not, and any plan promising it is lying.

## First task for the Grok team

Read this brief, then produce: (1) the design lead's screen-by-screen minimalism decisions for home and panic only, (2) the QA lead's test matrix, (3) the growth lead's day-7 launch checklist. Keep each deliverable short and concrete. Ask the owner for HANDOVER.md, REDESIGN_SPEC.md, and AUDIT_LAYER2.md if they are not already in this conversation.
