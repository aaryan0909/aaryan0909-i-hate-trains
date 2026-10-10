# CHANGELOG — I Hate Trains (local hardening, unpushed)

All changes are local in `~/workspace/i-hate-trains/`. Nothing pushed to GitHub (Aaryan away; push approvals time out). Push when he's back.

## v18 (2026-10-10 — Div's update-delivery + portability batch)
- **Updates actually reach the phone now.** Root cause of Div never seeing updates: the service worker was cache-first for everything (`iht-v17`), so her browser served the stale copy indefinitely. `sw.js` is now network-first for navigations and core versioned assets, with cache fallback when offline (offline law intact — the core calming loop still works with zero network). Cache bumped to `iht-v18`; old caches still purged on activate. Install no longer auto-`skipWaiting`s.
- **In-app "update ready" prompt.** When a new worker is installed and waiting, a calm banner appears on safe screens only (home, settings, about, history, plan — never breathing/panic/trip or any tool screen): "A fresh version is ready" + "Update when you're ready", which activates the new worker and reloads. Stoic tone, zero jokes. About screen now reads "version 18" so the installed version is checkable.
- **Storage hardening.** New `iht_schema_version` key + `migrateStorage()` on boot. It never deletes `iht_*` keys (only the user-initiated "erase everything" does) and preserves unknown keys for forward-compat. Div's existing pet/name/prefs/reflections/trips survive untouched.
- **"Move to another browser" (settings).** Export produces a compact copyable setup code (co-rider, name, prefs, reflections, trips, plans, saved links, coach flags) plus an optional downloadable file; Import restores it with a confirmation. Round-trip tested.
- **Pastel city themes.** Per-city accents calmed down (Aaryan: TTC red / Tube red / MTA yellow were too aggressive), keeping each city's hue family: Toronto soft coral #e59a86, London dusty rose #d78fa0, NYC soft butter #ecd27f, Paris seafoam pastel #96cbb8, Tokyo sakura pastel #f2a7bd, with matching inks and gradients. Sacred flow stays universal calm dark.

## v17 (2026-10-09 — Div's pet feedback)
- **Pet breathes with you, unmistakably.** The co-rider already scaled in sync with the breath bloom, but at 44px it was easy to miss — and after onboarding with a non-default pet, the breathe mount could still show the old pet. The breathe pet is now larger (72px) with a calm caption ("{name} breathes with you") naming the companion. Same timing, same easing, still calm.
- **Fixed: pet choice/name not propagating.** Four stale surfaces: (1) `finishOnboarding` only re-rendered the home pet, leaving trip/breathe/arrived/comfort mounts on the default; now calls `renderPetEverywhere()`. (2) The pet sheet's own preview never re-mounted on type change; now included. (3) The comfort card "Play with {name}" was built once at boot and never updated; now re-rendered on every pet change. (4) The "Mochi picks for me" sheet button was hardcoded; now follows the pet's name, as does the sheet's "Tap {name} for some love" line on rename.
- SW bumped to `iht-v17` so installed copies re-cache cleanly.

## v16 (Pilot 2026-10-09 — Spark-approved backlog item)
- **"What helped last time" card on the panic screen.** The reflection journal (`iht_journal`, on-device, capped at 100) was write-only; now the panic screen reads the most recent entry back as one calm card: "Last ride, {tool} helped. Want to start there?" with a "Start {tool}" button that launches that tool directly (via `openTool`, so walkthrough/gesture/interactive tools all work; return path is the panic screen). Card stays hidden when the journal is empty or the tool lookup misses; the whole read is wrapped so a corrupt journal can never break the sacred flow. Nothing leaves the phone. SW bumped to `iht-v16` so installed copies re-cache cleanly.

## Unreleased (hardening batch — Relay, 2026-10-06)
- **Fixed: mid-hold navigation left audio/rAF running.** The hold-to-steady tone and the muscle-release hold ring had no cleanup on screen change: navigating away mid-hold (e.g. tapping the SOS float with a second finger) left the tone droning and a `requestAnimationFrame` loop updating a hidden screen. `go()` now calls `stopHold()` and `stopMuscleHold()` on every navigation. (Root cause, not symptom.)
- **Fixed: breathing word-swap timeout leaked after navigation.** The 200ms caption-swap `setTimeout` in `runPhase` was untracked; `stopBreathe()` only cleared the phase timer, so a pending swap could fire after leaving the breathing screen and mutate hidden DOM (and briefly show a stale word on quick re-entry). Now tracked as `breathSwap` and cleared in `stopBreathe()`.

## v13 (on production partially — styles.css + sw.js live; index.html + app.js pending push)
- Toolkit icon-card language rolled across all screens.
- Geolocation errors distinguished: PERMISSION_DENIED → iOS Settings guidance; POSITION_UNAVAILABLE → "couldn't get a fix"; TIMEOUT → underground message.
- Cute-things redirects: YouTube default/recommended (works logged-out), sharper queries, TikTok/Instagram as options.

## v12 (live)
- Mochi the co-rider: tap-the-pet sheet (Play, Mochi-picks-for-me, rename, change), breathe-together sync, mood-reactive states. Zero-maintenance rule intact.
- UI uniformity: ride-flow card language across all screens.

## v11 (live)
- iOS long-press text-selection hijack fixed (`user-select: none` globally; inputs opt back in).
