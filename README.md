# I Hate Trains

A free pocket companion for people who get scared on trains. Mobile-first offline PWA — zero dependencies, works fully offline after first load. **Not a business: no premium, no paywall, no ads, no tracking. Everything free, forever.**

**Core mission:** help people who get scared on trains. Every decision is measured against one question: does this help a scared rider feel safer on their ride? The app roasts the commute, never the user.

## v4 (current): onboarding-first, breathing that breathes, visible geolocation

Fixes Aaryan's three v3 iPhone-test complaints:

1. **Onboarding first.** First launch walks name → location (with VISIBLE geolocation attempt: live status text, success message, honest underground fallback, "Try again" button) → how are you feeling → comfort links to save (optional). Stored on-device in `iht_profile`. Home greets by name, shows the rider's usual city · line, and frames the day: SOS dominant, "Start a ride" as one coherent journey (check-in → checklist → setup → trip → arrived → reflection). Floating SOS button on every screen except home, the panic flow, and onboarding. Ride setup prefills city/line from the profile.
2. **Breathing auto-starts.** The dead "ready — tap Begin" state is gone from HTML and JS. Tapping "Breathe with me" starts the exercise immediately: circle animating, phase words advancing on schedule. Web Audio phase cues (soft sine chime on inhale, lower/softer on exhale) default ON with a toggle in Privacy; the AudioContext inits on the tap gesture so it works on iOS. The visual rhythm carries the exercise even on mute. Leaving the screen always stops the timer cleanly.
3. **Visible geolocation.** `tryLocate` generalized: status element, city input, retry button, once-per-session per context, 8s timeout, BigDataCloud reverse-geocode when online, honest no-fix messaging. Auto-attempts in onboarding step 2 and at ride setup. Never blocks, never fails silently.

- **Haptics:** vibration patterns synced to breath phases, Android-only (iOS Safari has no Vibration API — stated honestly in Privacy: "iPhones use sound cues instead"), user toggle.
- Everything else from v3 kept: 17-tool coping library, non-breath entry, ride backup plan, reflection + history, comfort corner, offline law (service worker bumped to `iht-v4`), crisis resources, zero-joke sacred flow, no monetization.

## v3: feel-first rebuild, quality over quantity

- **Home:** one huge "I need help right now" panic button (Rootd-style) + calm "Start a ride" + "Open the toolkit".
- **Panic flow (sacred):** three honest paths — breathe with me, ground me instead, or "Breathing and counting don't work for me" (non-breath alternatives surfaced first, per the Manus build). Zero jokes inside — calm, direct, safe.
- **Toolkit:** the full Manus coping library, each tool done properly with its steps and safety notes: 5-4-3-2-1, 3-3-3, one-object details, safe place, progressive muscle release, kind words, box breathing, 4-7-8, cyclic sigh (with honest evidence framing: a 2023 daily-practice study found mood effects; not evidence for acute panic; stop/switch warning), panic facts, gentle thought check (CBT-inspired, not therapy), category game, backward count, familiar comedy/music cue, ride backup plan, confidence practice, after-ride reflection.
- **Breathing engine:** Gentle / Box / 4–7–8 patterns with slow easing circle, optional haptics synced to phases (vibration pulses on inhale, soft long buzz on exhale). Feature-detected — iOS Safari has no Vibration API, so it's a graceful no-op there. User toggle in Privacy. Stop-if-difficult warning always visible.
- **My plan:** editable ride backup plan (exit stop, person/tool to reach, pocket checklist, rider-written 3-step confidence plan). On-device, autosaves.
- **Location:** tries first, asks only if needed. Geolocation with 8s timeout on ride setup; if coords + online, reverse-geocodes via BigDataCloud (free, no key) and asks to confirm the city; if offline, shows coords and asks; if no fix (underground = no GPS, honest physical limit), graceful manual entry. Never blocks, never a spinner-of-death. Locale read from `navigator.language` (universal-safe default copy; per-country variants are a future hook, not v3).
- **Comfort corner (online-enhanced):** user-saved comfort links (their own favorite reels/posts, stored on-device) + Instagram redirect. Hidden gracefully when offline. True feed embedding needs Meta API review — honestly out of scope; noted as future native-track work.
- **Ride screen:** manual stop counter reframed as calm ritual, breathing/grounding/hum/toolkit/comfort/reach-out tools, trip card share with city, "I'm home".
- **Reflection + history:** before/after feeling, optional tools-that-helped chips, one-line note. Local only, no streaks, no grades. On-device erase-everything.
- **Crisis:** 988 (US/CA), 116 123 (UK Samaritans), rider-entered local number. "Not medical advice" disclaimer. Clinical honesty everywhere: coping tools, not treatment.

## Feel research (v3)

Researched before building: Rootd (panic button → two guided paths "face it" vs "find comfort"; reviewers praise "says exactly what someone having a panic attack needs to hear" and "feels like someone is with me"), Finch (gentle "First Aid Kit" when mood is bad, low-stakes, optional), Stoic (check-in/reflection rituals). Encoded as: 550ms opacity+rise transitions (no slides), staggered text entry (kicker → title → lede → actions), soft press feedback (scale + subtle haptic tick), slow breathing circle easing, per-phase captions, reduced-motion honored, 60px+ targets, one-handed use.

## Offline law

Service worker (`sw.js`, cache `iht-v4`) precaches the whole app shell. After first load, everything core works with zero network: panic flow, toolkit, breathing, grounding, plans, reflection, history. No backend. Online only enhances: city reverse-geocode, comfort links, trip-card share, crisis calls. Bump `CACHE` in `sw.js` on every content change so installed phones pick up the new build.

## Scope notes (honest)

- In scope: everything above.
- Out of scope for v3: Meta/Instagram feed embedding (needs API review), per-country humor/solution variants (locale hook only), native iOS build (separate Manus native track), live transit data / GPS stop detection (GPS doesn't work underground; manual ritual is the honest design).

## Deploy

Static site, zero dependencies. Vercel file deployment to the existing project (same production URL). GitHub repo still pending owner-side creation.
