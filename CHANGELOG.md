# CHANGELOG — I Hate Trains

Local source of truth is `~/workspace/i-hate-trains/`; the GitHub repo `aaryan0909/aaryan0909-i-hate-trains` (main) is pushed via `push_files` and Vercel auto-deploys from it.

## v28 (2026-10-21 — "Calm facts": a calm-time Learn tab, Pilot)

- **The education layer the app was missing.** Rootd's other headline feature is lessons on understanding panic, praised in reviews as guidance "backed up with facts" — IHT had nothing. A new "Learn" home tile opens a calm-time-only screen ("calm facts"): 5 short, honest reads (~1 min each), written once, curated, cited — the adrenaline wave peaking then passing (DSM-5), why 5-4-3-2-1 grounding works, what slow breathing actually does (Balban et al. 2023, Cell Reports Medicine), scary thoughts as predictions (Clark 1986 cognitive model), and rides getting easier with repetition (graded exposure). Stoic tone, zero jokes, clinical honesty ("coping tools, not treatment"), each read ending with a one-line honesty/source list and a "Try the tool this explains" button into the matching toolkit exercise.
- **Sacred flow untouched.** The only entry is the home tile: nothing in the panic flow, crisis screens, or tools links to Learn. No storage keys, no network, no accounts — fully offline. SW bumped to `iht-v28`; About reads "version 28". Calm screen, so the SOS float stays visible and the update banner treats it as a safe screen.

## v27 (2026-10-20 — "Talk me through it": eyes-free, voice-led rescue, Forge)

- **A fourth option on the panic screen, for when reading is impossible.** "Talk me through it" is visually distinct (near-black card, night-voice icon) alongside Breathe / Ground / Cute. One tap launches a near-black eyes-free screen: the pet breathes visibly in sync (large, centered, same easing as the breathe screen), the phase word is the only thing on screen, and the v22/v23 voice auto-enables *inside this mode only* — the tap itself is the opt-in, so the no-autoplay rule stays intact. Scripted linear rescue, no decisions: an acceptance line ("You're doing okay. This will pass.") → 3 paced breaths (4s in / 4s out) → rapid 5-4-3-2-1 grounding ("Five things you can see…") → a close ("You did well. I'm right here."). One full-width "I'm steadier" ghost button ends it at any moment; leaving the screen any other way stops the voice and timers cleanly (go() hook). No menu, no reading, no pattern chips, no config. Fully offline, no storage keys, zero jokes; crisis flow untouched otherwise.
- Entrance-animation delays are killed on the rescue screen (`#screen-guide .rise` renders instantly — scope-limited fix for the queued instant-render item).
- Transport note: ships as `guide.js` (same module-split pattern as crisis.js / stopheads.js); app.js carries only 3 hooks (SOS hidden list, go() cleanup, a `window.__ihtGuidePet` bridge exposing petInto + the pet name) so it stays pushable.
- SW bumped to `iht-v27`; About reads "version 27".

## v26 (2026-10-18 — "Your stop, out loud", Pilot)

- **Your stop, out loud.** Spark-approved backlog item (Rootd and Dare can't do this — they don't track stops). The trip setup screen gains an opt-in toggle, off by default: at 2 stops out and 1 stop out, the pet's voice says the heads-up — "Two stops to go. You're doing great." / "Next stop is yours. Take a breath." Fully offline, reusing the v22/v23 iOS-hardened voice (human-voice picker, rate 0.75 / pitch 0.9, warm inside the toggle gesture with instant "Voice on." proof, never cancel()+speak() in the same tick). Fired from `advanceStop()`, the ONE stop counter, so manual taps and TriMap auto-advance both pass through it; no speech on arrival (the arrival screen owns that moment). Calm-time setup only — never in the panic flow. Ships as `stopheads.js` (same split pattern as `crisis.js`): app.js exposes `window.__ihtVoice` (speak/warm/stop + the live prefs object, so the toggle and app.js can never hold stale prefs) and calls `window.__ihtStopHeadsUp(trip.left)` defensively; the new module is loaded after app.js and precached. Verified: node --check clean + 37/37 jsdom checks (default off, warm-up proof line, exact-threshold speech at 2 and 1, silence when off, pref persistence, prefs-sharing across modules).
- Transport note: app.js crossed the 131,072-byte single-argv push cap again (v26), which is why the feature lives in its own module — app.js stays pushable.
- SW bumped to `iht-v26`; About reads "version 26".

## v25 (2026-10-17 — one-tap "Call my person", Forge)

- **Your backup person is one tap away.** The backup plan ("One person or tool I could reach for") gains two optional fields: their name and their number (type=tel, saved on this phone only, inside the existing `iht_plan` store — export/import and erase-everything need no changes). When a real number is saved, the reach-out (crisis) screen renders "Call {name}" as the first row, above 988 — tel: href built with the existing sanitization, under the existing honest "Tapping a number leaves the app and uses your phone service" disclosure. Numbers under 7 digits are treated as unset (no dead tel: link); name falls back to "Call my person"; everything set via textContent (no HTML injection). Zero jokes, same `.crisis` card style, offline-safe.
- SW bumped to `iht-v25`; About reads "version 25".

## v24 (2026-10-14 — locale-aware crisis line, Aaryan's go)

- **The panic-screen line is no longer 988 for the whole world.** Aaryan's verdict on v20: 988 is US/Canada-only and wrong as the worldwide line. The quiet line at the bottom of the panic screen now shows the real number for the phone's locale (`navigator.language` → region), from a table of 9 lines verified 2026-10-14 from official sources: 988 (US/CA, call or text), 116 123 Samaritans (UK/IE), 02 2327 2327 Telefono Amico Italia (IT), 3114 (FR), 0800 111 0 111 Telefonseelsorge (DE), 024 (ES), 13 11 14 Lifeline (AU), 113 (NL), 1800-599-0019 Kiran (IN). Unknown locales get "find help where you are" → findahelpline.com (correct domain, not .org). Nothing invented; no network, all on-device.
- **Crisis screen leads with the locale line** (above the 988 row; skipped when the locale line IS 988 or 116 123 to avoid duplicates), plus a quiet "Somewhere else in the world? Find a helpline where you are." link and the same link in About's "If it gets really bad" list.
- **Bug fix riding along:** the `.crisis` card class sets `display:block`, which silently defeats the `hidden` attribute — the rider's "My local number" row was rendering as an empty dead card when no number was saved. Added `.crisis[hidden]{display:none}`; the new locale row uses the same hook.
- Sacred flow untouched: same calm line, zero jokes, same 44px tap target. Storage untouched (no new keys). Verified: node --check clean + 193/193 jsdom checks across 13 locales (it-IT shows 02 2327 2327; xx-YY and empty locale fall back to the directory).
- Transport note: app.js outgrew the 131,072-byte single-argument push cap, so the crisis module lives in its own `crisis.js` (loaded before app.js, precached in sw.js; app.js calls it defensively via `window.__ihtCrisis`).
- SW bumped to `iht-v24`; About reads "version 24".

## v23 (2026-10-12 — humanize "A calm voice", Aaryan's go)

- **The voice is human now.** Aaryan's verdict on v22: "wayyy too robotic... almost scary." Three changes: (1) the voice picker now scores every on-device voice and takes the most human one — enhanced/premium/natural/neural/Siri voices first, the stock compact robot last (graceful fallback if the phone has nothing better); (2) prosody softened to rate 0.75, pitch 0.9 — calm, unhurried, warm; (3) the script is gentle cues instead of a counting machine: "breathe in…", "hold…", "and out…", "rest…". The pet's visible breathing carries the timing; the voice just guides.
- Everything else from v22 kept: off by default, toggle warms the engine in the gesture ("Voice on." proof), never cancel()+speak() in the same tick, resume() before speaking, silent-switch hint under the toggle.
- Storage: additive only — no new keys, no schema change. Div's setup survives.
- SW bumped to `iht-v23`; About reads "version 23".

## v22 (2026-10-12 — pet-led breathing + voice fix, Aaryan's go)

- **Mochi is the breathing guide.** Aaryan's verdict on the flower bloom: "not very impactful, eye catching, or even helpful." The bloom is gone; the pet now sits large and centered (172px) where it was, and visibly inhales/exhales in sync with each phase (scale 1.0 → 1.4 on the phase timing). The caption under the exercise reads "Follow Mochi." (pet name respected). Extends Div's 2026-10-09 ask — the pet is the guide now, not a bystander. Sacred flow untouched: calm only, zero jokes.
- **"A calm voice" becomes the pet's voice.** Both toggles (breathe screen + Privacy) now read "[Pet]'s voice" with the pet's name, e.g. "Mochi's voice". The spoken count-ins are unchanged — they are the pet telling you when to breathe.
- **iOS voice fix.** Aaryan heard nothing on his iPhone with the toggle on. Hardened: (1) flipping the toggle ON now warms the speech engine inside the gesture and speaks "Voice on." — instant audible proof it works (and the gesture unlocks iOS speech); (2) never cancel()+speak() in the same tick (iOS Safari swallows the utterance — cancel only when the engine is busy, then speak 120ms later); (3) resume() a paused engine before speaking. Honest hint under the toggle: "If you hear nothing, check the silent switch and volume." (iOS gives no API to detect or override the silent switch.)
- Storage: additive only — no new keys, no schema change (`iht_schema_version` stays 1, `iht_prefs.breathVoice` reused). Div's setup survives.
- SW bumped to `iht-v22`; About reads "version 22".

## v21 (2026-10-12 — "a voice in the dark", opt-in calm count-ins)

- **A calm voice for breathing, off by default.** New opt-in toggle ("A calm voice", on the breathe screen and in Privacy settings): when on, the device's own speech engine quietly counts each breath phase ("Breathe in — one, two, three, four") at a calm 0.85 rate. No audio files, no network, nothing leaves the phone; enabling the toggle never plays a sound — the voice only starts when the user begins a breathing session they chose. Ending the exercise or leaving the screen stops it immediately.
- SW bumped to `iht-v21`; About reads "version 21".
- Also synced `styles.css` to git main (the v20 `.q988` quiet-crisis-line style had only ever been file-deployed, so the first v21 auto-deploy briefly served it unstyled; now committed).

## v20 (2026-10-11 — quiet 988 line on the panic screen)
- **Crisis escalation in the sacred flow.** The panic screen carried no crisis line — 988 lived only on screen-crisis, two taps from a panicking user. One quiet thumb-sized line now sits at the bottom of the panic screen (below "See my backup plan"): "If it ever gets really bad: call or text 988" (tel:988). Calm ink, 44px tap target, zero jokes; sacred flow untouched.
- SW bumped to `iht-v20`; About reads "version 20".

## v19 (2026-10-11 — drift ambient music + TriMap TTC map + v18 core)
- **"Drift": a truly calming ambient piece.** New `drift.js`: an original Weightless-style generative composition rendered live with Web Audio (zero audio files, fully offline). ~8-minute deterministic arc — warm pads with long attack/release, sparse soft plucks, sub-bass roots, felt tempo easing from ~55 toward ~45 bpm, no percussion, no surprises, seamless loop. It upgrades the existing `ambient` sound mode in place (settings options unchanged: Chimes / Ambient / Both / Off); if `drift.js` ever fails to load, the legacy pad plays instead. iOS-safe (context still owned by `ensureAudio()`, never auto-plays).
- **TriMap: per-ride line chooser + live TTC map.** New `trimap.js` + `ttc.json` (compact TTC subway data, generated by `tools/build_ttc.py` from GTFS static). At trip start: "ride your usual line" vs "choose each time", origin/destination stop pickers, optional live map with the real pastel route, stops, and GPS rider dot. One shared stop counter — manual taps and map auto-advance both call `advanceStop()`. Online-only enhancement: offline or no-GPS falls back to the existing manual stop-tap ritual (GPS sleeps underground, said honestly in the UI). Trip-setup surface only; panic/breathing/grounding/crisis code untouched.
- **v18 core (finally pushed): update delivery + storage migration + export/import + pastel themes.** Network-first service worker (`iht-v19` precache now includes drift.js, trimap.js, ttc.json), calm in-app "update ready" prompt on safe screens, `iht_schema_version` + `migrateStorage()` that never deletes user keys, "Move to another browser" export/import in settings, pastel per-city accents.

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
