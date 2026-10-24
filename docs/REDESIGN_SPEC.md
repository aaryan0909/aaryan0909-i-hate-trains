# I Hate Trains: Redesign Spec (v31 direction)

**Status:** APPROVED 2026-10-24 and BUILT as v31 (see CHANGELOG.md). The spec below is the design record; the audit (AUDIT_LAYER2.md) wins on all disagreements.
**Date:** 2026-10-24. Current live version: v30.
**Trigger:** Aaryan's 2026-10-24 feedback, in his words: the app feels overcrowded and wordy, the pet is an afterthought instead of the guide, and the app needs a start screen plus a way to test it on a laptop that actually matches a phone.

**Why this spec exists:** versions v23 through v30 added features and almost nothing was removed. The app now has 38 screens. Each addition was individually reasonable. Together they broke the original promise: minimal, calm, one thing at a time. This redesign subtracts first, then rebuilds the pet as the guide, then adds exactly one new surface (the start screen).

**Hard constraints (unchanged):**
- Offline-first, zero dependencies, no backend, no tracking. Everything works in a tunnel with no signal.
- Vanilla HTML/CSS/JS in `~/workspace/i-hate-trains/`. The three core files total about 243KB; the whole web app is roughly 330KB. Keep it small.
- Panic and crisis flows are sacred: calm, minimal, zero jokes. Humour only on brand surfaces, roasts the commute, never the rider.
- Pet zero-maintenance rule: no hunger, no sadness, no death, no guilt. Ever.
- Clinical honesty: coping tools, not treatment. Stop-if-difficult guidance on breathing. Crisis numbers real and locale-correct.
- No invented users, metrics, or test results. No device behavior claimed without a real test.

---

## A. Minimalism research: what "less is more" actually means here

This section is the research Aaryan asked for. Six sources, each distilled into a rule this app must follow. The point is not taste. The point is that a person mid-panic has a fraction of normal working memory, so every extra word, button, and decoration is a tax on the one job the app has.

### 1. Apple Human Interface Guidelines (clarity, deference, depth)
Apple's three themes, applied honestly:
- **Clarity:** text legible at a glance, icons precise, adornments restrained. Rule for us: if an element does not help the rider decide their next tap, it is decoration, and decoration is cut from every screen except the home brand surface.
- **Deference:** the interface steps back and lets content lead. Rule for us: on guide screens (breathe, grounding, rescue), the pet and the single instruction are the content. Chrome, headers, and secondary nav disappear while a tool runs.
- **Depth:** subtle layers and motion communicate hierarchy. Rule for us: depth comes from the pet's layered shading and one shadow, not from borders, boxes, and background patterns stacked on each other.

### 2. Material Design (calm, large, meaningful motion)
Material's guidance on touch targets (48dp minimum, larger for primary actions), restrained color, and motion that means something. Rule for us: primary actions are full-width and at least 60px tall (our existing bar, kept). Secondary actions shrink to quiet text links, never to competing buttons. Motion is reserved for two things only: the pet breathing, and the one transition between screens. Everything else is static.

### 3. Rootd (panic apps must decide for the user)
Rootd's whole model is two paths: face it, or find comfort. Users praise it for saying exactly what someone having a panic attack needs to hear. Rule for us: mid-panic, the app offers at most 3 visible choices, and one of them is visually dominant. The current panic screen has 6+ options. That is the single biggest violation in the app.

### 4. Stoic (ritual, restraint, slowness)
Stoic's power is ritual and restraint: one check-in, one reflection, slow transitions, dark calm palette. Rule for us: calm-time screens get the same restraint. History, plan, and learn are reference screens, not dashboards. No stats, no streaks, no counts competing for attention. (v30's "What has helped you" card already avoids scores and streaks. Keep that discipline.)

### 5. Finch (the companion is the product)
Finch's insight is that people open the app for the pet, not for the feature list. The pet greets, guides, and reacts, and the tools are things you do *with* the pet. Rule for us: the pet is present on every screen, leads every flow, and speaks the instruction. Text that the pet can say in one line does not also appear as a paragraph.

### 6. Cognitive load under stress (Hick's law, working memory)
Hick's law: decision time grows with the number of choices. Under acute stress, working memory shrinks further. This is not a preference, it is the design constraint that makes minimalism a safety feature here. Rule for us, stated as numbers so it can be checked in review:
- **Panic screen:** at most 20 words visible, at most 3 actions, 1 dominant.
- **Home screen:** at most 40 words visible, 1 dominant action, at most 4 secondary tiles.
- **Tool screens:** one instruction line at a time, at most 8 words per line, no explanatory paragraphs while the tool runs. Explanations live one tap away, never inline.
- **Every screen:** one primary action. If a reviewer cannot name it in one second, the screen fails review.
- **Element size:** primary action full-width, 60px+. Pet large on guide screens (roughly 40 percent of viewport height on breathe and rescue). Secondary controls shrink to 44px text links or icons. Decorative visuals that do not guide are removed, not shrunk.

**The balance Aaryan asked for:** minimal does not mean empty. It means one dominant thing, one supporting thing, and everything else one tap away. Warmth comes from the pet, not from copy.

---

## B. Screen-by-screen "less is more" audit

Opinionated and specific. CUT means remove from the screen (the feature may survive one tap away, noted where it does). HIDE means move behind one tap. SHRINK means keep but make smaller and quieter. Every screen ends with its single primary action.

### Home (screen-home)
Current problems: greeting, pet card, "What has helped you" card, Learn tab, toolkit/comfort/plan/history/privacy/about tiles, ride setup, crisis line. Too many competing cards.
- CUT: the crisis line from home (it lives on the panic screen and the reach-out screen, where it is needed; home does not need it).
- CUT: the "What has helped you" card from the default home view. It is a good idea that competes with the panic button. It becomes a row inside the toolkit, one tap away.
- HIDE: privacy, about, history, plan behind one "More" text link at the bottom. Nobody needs settings on the home screen.
- SHRINK: greeting to one line ("Hey, Aaryan." plus pet). City/line line becomes small text under the pet, not a card.
- PRIMARY ACTION: "I need help right now" (unchanged, dominant). Secondary: "Start a ride" and "Open the toolkit" as two quiet rows. Learn becomes one row beside them, not a tab.

### Panic (screen-panic)
Current problems: hero rescue plus breathe, ground, cute, 3-3-3, backup plan. Six options while panicking.
- CUT: "Show me something cute" from the panic screen (comfort is a calm-time and post-panic destination, not a panic decision; it stays one tap away via toolkit).
- CUT: "Start 3-3-3 noticing" as a separate row (it is a grounding tool; it lives inside "Ground me instead").
- CUT: "See my backup plan" from the panic screen (the plan is pre-ride work; mid-panic it is a distraction).
- PRIMARY ACTION: "Talk me through it" (the v27/v29 hero, eyes-free rescue). Secondary, exactly two: "Breathe with me" and "Ground me instead". Total visible words under 20. The crisis line stays, quiet, at the bottom, unchanged.

### Breathe (screen-breathe)
Current problems: pet plus phase words plus pattern picker plus voice toggle plus stop-if-difficult text plus timer, all competing.
- CUT: the pattern picker from the running screen (pattern is chosen once, before starting, or remembered from last time).
- CUT: the timer display while breathing (a countdown is the opposite of calm; progress is shown by the pet's breath cycle itself).
- HIDE: voice toggle and stop-if-difficult note behind one small "options" affordance, and keep the stop-if-difficult line as a single quiet line at the very bottom, not a block.
- SHRINK: phase words to one word ("In" / "Out") beside the pet, not a caption block.
- PRIMARY ACTION: the pet breathing. The pet IS the exercise. One large "Stop" text link ends it.

### Toolkit (screen-toolkit)
Current problems: 23 tools, featured row, category groups, non-breath list, each card with its own living visual. Rich, but a wall of choice.
- CUT: the featured row (it duplicates the category groups and adds a second decision layer).
- HIDE: category groups behind 4 quiet section headers that expand on tap (Breathe, Ground, Comfort, Think). One section open at a time.
- SHRINK: tool cards to one line each (pet mini-icon plus name). The living mini-visuals survive only on the tool's own screen, not in the list.
- PRIMARY ACTION: the search-free, one-tap start of the tool the rider already knows they want. The toolkit is a shelf, not a showcase.

### Ride: setup, trip, arrived (screen-setup, screen-trip, screen-arrived)
Current problems: setup asks city, line, stops, duration, voice toggle, and plan review in one flow; trip screen carries a full toolbar.
- CUT: duration from setup (it is not needed for a manual stop ritual; the rider taps per stop).
- HIDE: voice toggle ("Your stop, out loud") behind one row in setup, remembered from last time.
- SHRINK: trip toolbar to three items only: stop tap (dominant), breathe, steadier. Everything else (comfort, toolkit, plan) moves behind one "More" affordance.
- PRIMARY ACTION: setup: "Start ride". Trip: the big stop tap. Arrived: "I'm home" (dominant) plus one quiet reflection prompt, not a form.

### Comfort (screen-comfort)
Current problems: calm cards, platform picker, saved links, categories, all visible at once.
- CUT: saved-link management from the main comfort view (editing links moves to one "Edit" affordance).
- HIDE: the platform picker behind the first tap on a category (the app remembers the last platform; YouTube stays the default).
- SHRINK: categories to a single quiet row of 4 chips.
- PRIMARY ACTION: one tap on a calm card that starts playing or opens. Comfort is one tap, not a browse session.

### Plan / backup plan (screen-plan)
Current problems: exit stop, person, pocket checklist, confidence plan, all editable inline on one long screen.
- CUT: nothing (the plan is pre-ride work and deserves its space), but:
- HIDE: each section behind an expanding header. One section open at a time.
- SHRINK: section headers to one line each.
- PRIMARY ACTION: "Save plan" as the only button. Editing is the action; viewing is the default state.

### History (screen-history)
Current problems: reflection entries with before/after feelings, tools-that-helped chips, notes, erase control, all competing.
- CUT: the tools-that-helped chips from the list view (they belong on the entry detail, one tap away).
- SHRINK: each entry to one line (date plus one feeling word). Tap to expand.
- PRIMARY ACTION: reading one entry. Erase-everything stays, but as a quiet text link at the bottom, not a button.

### About (screen-about)
Current problems: pet controls, themes, voice settings, storage, version, update controls, all stacked.
- HIDE: everything behind sections (Pet, Look, Sound, Data), one open at a time.
- SHRINK: version and update status to one quiet footer line.
- PRIMARY ACTION: none (it is a settings screen). The rule here is: nothing on About competes with anything, because nothing on About is urgent.

### Learn (screen-learn)
Current problems: 5 reads, each with an intro, body, and tool button. Good content, but it reads like an article index on a panic app's home.
- CUT: Learn from the home screen entirely (it becomes a row in the toolkit's "Think" section).
- SHRINK: each read's listing to one line (title only). Body and "Try the tool" button appear on the read's own screen.
- PRIMARY ACTION: reading one read. Nothing else on the listing screen.

### Onboarding (screen-ob1 to screen-ob5)
Current problems: 5 screens before first use, each with its own escape button, status text, and inputs.
- CUT: the "how are you feeling" screen (feeling is captured at first check-in, not demanded before the app is usable).
- CUT: the comfort-links screen (optional links are added later from Comfort, not demanded upfront).
- SHRINK: location step to one line plus one button ("Use my location" / "Skip, I'll type it").
- PRIMARY ACTION per screen: name, then location, then done. Three screens, not five. Every screen keeps its "I need help right now" escape (non-negotiable).

### Other tool screens (senses, hold, muscle, butterfly, categories, countdown, trace, walk, swipebreathe, kindwords, thought, calm, nonbreath, petplay, trimap, checkin, checklist, reflect, guide, crisis, privacy)
Same rules, applied uniformly: one instruction line at a time, pet leads, options behind one tap, no paragraph blocks while a tool runs. The crisis screen is exempt from cuts (its content is safety information, not decoration) but still gets the one-primary-action treatment: the call action dominates, everything else quiets.

---

## C. Pet as companion: technical design

Goal: the pet stops being decoration and becomes the guide. A rider should feel the pet is with them, looking at them, breathing with them, and leading them through the app. All of it in vanilla CSS/JS and inline SVG, offline, no image or audio assets, no new dependencies.

### What the pet is built from
One inline SVG per species, layered for fake depth (this is the "3D at least" answer):
- **Base body:** a soft blob path with a radial gradient (light top-left, darker bottom-right). One gradient does more for depth than any outline.
- **Highlight layer:** a small translucent white ellipse near the top-left, blurred via SVG filter, suggesting a rounded surface catching light.
- **Contact shadow:** a soft ellipse under the pet that scales with the pet's squash, grounding it on the screen.
- **Face layer:** two eyes (white, pupil, tiny highlight dot) and a mouth path, drawn as separate SVG groups so they can move independently.
- **Blush/cheek layer:** two faint radial circles, opacity animated subtly, only on calm screens (never on the panic screen, where cuteness competes with calm).
Total: one SVG, roughly 15 to 25 elements, all transform-animated. No raster images, no sprite sheets, no asset downloads.

### Breathing WITH the user (the core fix)
Today the pet animates on its own loop while the breathing engine runs its own timer. That is why it feels "there on the screen breathing, not with you." Fix:
- **One timer drives both.** The breathing engine's phase clock becomes the single source of truth. The pet's scale is a direct function of phase progress: inhale scales the pet up (about 1.0 to 1.18, with a slight vertical stretch and horizontal squash, classic squash-and-stretch), hold keeps it at peak, exhale scales it back down. No separate pet animation loop exists during breathing.
- **The pet IS the inhale/exhale signal.** The phase word ("In" / "Out") becomes secondary, small, beside the pet. A rider with eyes half-closed follows the pet's size, not text.
- **Phase-matched motion curves:** inhale eases out slowly (calm expansion), exhale eases in slightly faster (release). The pet's shadow shrinks as the pet rises on inhale, reinforcing the lift.
- **Voice sync:** the spoken cue ("breathe in") fires at the exact phase boundary the pet starts moving, not on a separate timer.
- **Outside breathing:** the pet idles with a slow, subtle scale cycle (about 6 seconds, amplitude under 3 percent) so it reads as alive without distracting.

### Looking at the user
- **Pupil tracking:** pupils translate a few pixels toward the last tap point on the screen (clamped to a small range), easing back to center over about 2 seconds. On the panic screen, pupils default to center-forward: the pet looks at the rider, not away.
- **Blink cycle:** eyelids (eye groups scaled vertically) blink every 3 to 6 seconds, randomized, with a fast close and slightly slower open. During breathing, blinks pause on inhale and resume on exhale, so the pet never looks away mid-breath.
- **Head tilt:** the whole face group rotates a few degrees toward the last tap side, and tilts slightly on "petting" (see below). Small angles only (under 6 degrees). Anything bigger reads as cartoonish and breaks the calm.

### Reactions (alive, not needy)
All reactions are celebratory or companionable, never guilt or need. The zero-maintenance rule is a hard guardrail: the pet never asks for anything, never looks sad, never degrades.
- **Petting:** tapping the pet squashes it briefly (scale Y down, scale X up, 150ms) and it springs back with a soft overshoot. Occasionally (not every tap) it closes its eyes happily for half a second. No counter, no affection meter, no reward text.
- **Tool completed:** one happy bounce (two small hops) plus eyes that close briefly in a smile shape. No confetti, no points, no streaks.
- **Arriving (ride done):** the pet does a slow celebratory rise and the caption is one line from the pet ("We made it."). One line, not a paragraph.
- **Panic screen:** the pet is large, centered, still except for slow breathing, eyes forward, mouth a calm small curve. No bouncing, no blush, no playfulness. The pet's job here is steady presence.
- **Calm screens:** the pet is smaller, off to one side or above the content, with idle motion and occasional blink, available for petting.

### The pet leads every screen (copy replacement)
This is the structural change, not just animation. Today screens explain themselves in paragraphs. After this redesign:
- Every screen's instruction is a single pet speech line, at most 8 words, rendered as a small caption near the pet ("Let's breathe together." / "Tap each stop as it comes." / "Pick what sounds bearable.").
- Paragraphs of explanation move one tap away ("Why this works" / "About this tool") and are never shown by default on a running tool.
- Screen transitions keep the pet persistent: the pet element does not unmount between screens. It cross-fades in place while content changes around it, so it feels like one companion walking the rider through the app, not a new mascot per screen.
- The pet's name is used in its lines ("Mochi is right here with you."), and the chosen species and name are respected everywhere (existing rule, kept and enforced in review).

### What is honestly NOT feasible (say it plainly)
- **True 3D (WebGL, meshes, skeletal rigs):** out of scope. It would break the 330KB offline budget, need a rendering library (violating zero dependencies), drain battery, and perform badly on older phones. The layered-SVG approach gives depth cues (gradient, highlight, shadow, squash-and-stretch) that read as dimensional on a phone screen, but it is 2.5D, not true 3D. Do not promise otherwise.
- **Real-time face tracking or gaze following via camera:** out. It needs camera permission, on-device ML, and a library, and it would be creepy for a panic app. Pupil tracking follows taps, not faces.
- **Lip sync:** out. The pet's mouth moves on phase boundaries (open slightly on inhale, closed on exhale), not phoneme-synced speech. The voice cue and the pet's breath stay in sync; the mouth does not form words.
- **Procedural personality or AI chat:** out. The pet's lines are a fixed, reviewed set. A panic app must never improvise words to a frightened rider.
- **Performance ceiling:** all pet animation must be transform and opacity only (GPU-friendly). No layout-affecting animations. If a device cannot hold 60fps on the pet, the pet degrades to static with caption-led breathing, never to a janky animation.

---

## D. Start screen spec

**Concept:** a loading screen meets an addictive sitcom intro. Short, warm, hummable, and gone before it can annoy.

### Duration and structure
- **Total: 2.0 to 2.5 seconds, never over 3.** Structure: 0.0s pet fades in (small, centered, with a soft scale-up), 0.3s the motif plays (see below), 1.0s the app name appears under the pet in one line, 2.0s the screen cross-fades to home. No progress bar, no spinner, no loading text (a spinner on a calm app is the wrong first impression).
- **Skippable after 1 second:** any tap after the first second dismisses immediately to home. Before 1 second, a tap is ignored (so an accidental launch tap does not flash the user past the intro into confusion).
- **Panic path never blocked:** the start screen always shows the "I need help right now" button, full-width, at the bottom, from 0.0s. A tap on it goes straight to the panic screen, skipping the rest of the intro. This is non-negotiable: the intro must never stand between a frightened rider and help.
- **Every open, but smart:** the intro plays on every cold open. On warm resume (app already in memory), it is skipped entirely. If the rider has opened the app 3 times in one day, the intro shortens to 1.2 seconds automatically (pet plus motif only, no name fade). Nobody should feel punished for opening the app often.
- **Reduced motion:** the intro becomes a static pet plus name for 0.8 seconds, then home. No scale animation, no fade choreography.

### The motif (original, hummable, no copyrighted melodies)
- **Original composition, 4 notes, about 1.2 seconds.** Written for this app, not borrowed from any show. Suggested shape: a gentle rising figure (for example, a major-third lift followed by a resolving step down), played as soft sine/triangle tones with a slow attack and a warm low pad underneath. The exact notes are the composer's choice at build time, but the constraints are fixed: 4 notes maximum, major key, slow tempo (about 80 BPM), no percussion, no jingle energy. It should feel like a hum, not an ad.
- **Synthesis only, zero audio files.** The existing Web Audio setup (already used for breathing cues and the Drift ambient piece) synthesizes the motif at runtime. Nothing to download, nothing to license, offline by construction.
- **Honest autoplay caveat:** iOS Safari blocks audio before a user gesture. On a cold open with no prior gesture, the motif may not sound until the rider's first tap (which dismisses the intro). Design for this: the intro is fully satisfying silent (pet plus name), and the motif plays on the first tap of the session if it was blocked. Do not add a fake "tap to start" gate. The intro must never demand interaction to proceed.
- **Volume:** quiet, about half the breathing cue volume. It is an intro, not an alarm.

### Desktop phone-frame preview (laptop testing that matches the phone)
Aaryan's requirement: test on a laptop and see exactly what a phone shows.
- **Approach: pure CSS, no new tooling.** On viewports wider than about 500px, the app column is capped at 390px wide and 844px tall (a standard phone logical size), centered on a dark page background, wrapped in a phone frame: rounded corners (about 48px radius), a thin bezel, a small notch/dynamic-island pill at the top, and a soft shadow. The app's internal layout does not change at all; it is the same CSS, same breakpoints, same 390px column the phone renders.
- **Why this is accurate:** the app is already a single-column mobile layout. Capping the column at phone width on desktop makes the laptop render the same layout, same text sizes, same tap targets. What it does not replicate: actual touch (mouse clicks instead of taps), iOS Safari quirks (safe areas, AudioContext gesture rules, Home Screen standalone behavior), and real performance. Those still need a phone test before shipping.
- **Toggle:** a small "phone frame" affordance is unnecessary; the frame appears automatically on wide screens and disappears on narrow ones. No setting, no build flag.
- **Scroll behavior:** the frame itself does not scroll; the app column inside it scrolls exactly as it does on a phone. On short laptop windows, the frame scales down proportionally (CSS transform scale, centered) so the whole phone stays visible.

---

## E. Build order and owner decisions

### Build order (least risk first, highest value early)
1. **Phone-frame preview (half a day, near-zero risk).** Unlocks Aaryan's laptop testing for everything after it. No app behavior changes.
2. **Minimalism pass, phase 1: panic, home, breathe (the three screens that matter most).** Apply section B's cuts to these three screens only. Ship, test on Aaryan's phone, then continue. This is where the "less is more" feeling is won or lost.
3. **Pet engine (the risky one).** Single-timer breath sync, blink cycle, pupil tracking, squash-and-stretch, reactions. Build it as one module, test it on the breathe screen first, then roll it out screen by screen. Performance-test on an older phone before shipping.
4. **Pet-led copy rewrite.** Replace paragraphs with pet speech lines across all screens, using the section B audit as the cut list.
5. **Minimalism pass, phase 2: remaining screens.** Toolkit, ride, comfort, plan, history, about, learn, onboarding.
6. **Start screen.** Last, because it sits on top of everything else and its design depends on the final pet and home. The motif is composed during this phase, not before.
7. **Full regression pass.** Dead-button audit, storage upgrade test, offline test, reduced-motion test, real-phone test on Aaryan's and Div's phones. Nothing ships without this.

### What is risky (say it plainly)
- **Pet engine performance:** the most complex animation work in the app's history. If it janks on a real phone, it actively harms the panic experience. Mitigation: transform-only animation, degrade to static on weak devices.
- **Removing features people use:** "What has helped you," the Learn tab, and the featured toolkit row were all built for real feedback. Hiding them (not deleting them) is the mitigation, but Aaryan must accept that some riders will need one extra tap for things they used to see immediately.
- **Splash autoplay:** iOS may silence the motif on cold opens. The design handles it (silent intro is still complete), but the "hummable intro" promise depends partly on platform behavior outside our control.
- **Scope creep:** this redesign touches nearly every screen. The phase order above exists to prevent a half-finished redesign shipping. Do not start phase 3 before phase 2 is tested.

### Decisions only Aaryan can make
1. **How aggressive are the cuts?** Hide-behind-one-tap (recommended) versus delete outright for: "What has helped you" card, Learn tab placement, featured toolkit row, comfort saved-links management.
2. **The motif:** pick the feeling from three described options at build time: (a) warm rise and resolve (recommended, calmest), (b) playful two-note bounce (more sitcom, less calm), (c) near-silent (pet only, motif only on first tap). He should hear all three before choosing.
3. **Splash frequency:** every cold open (recommended) versus once per day. And whether the 3-opens-a-day shortening rule is wanted.
4. **Pet default:** keep Mochi as the default species, or let first-launch pick from the species list with the pet introducing itself? (Recommendation: keep Mochi default; choice stays in About.)
5. **Learn tab fate:** does Learn survive as a toolkit row, or is it cut entirely until the redesign settles?
6. **The one-sentence test:** after phase 2, Aaryan opens the app on his phone and answers one question: does it feel minimal, or does it feel empty? That answer decides whether phase 4 goes further or pulls back.

---

*End of spec. Next step: Aaryan approves (or edits) this document. No code is written from it until he does.*


---

# v2: online-enabled journey

**Status:** SPEC ADDITION, 2026-10-24. Same rule as v1: no code until Aaryan approves.
**Trigger:** Aaryan changed a core law the same day v1 was written. His words: forget strict offline-first. Most subways have internet now. Core features must still work offline, but features that make the app better should not be blocked by the offline rule.
**New law: "offline floor, online ceiling."** The floor (section C) is sacred and unchanged in spirit. The ceiling is new: when the network is there, the app should use it to be genuinely better, not just the same app with a loading spinner. Nothing in v1 is deleted by v2. The minimalism audit, the pet-as-companion design, and the start screen all still stand. V2 adds the journey and the online layer on top of them.

## A. The end-to-end journey, stage by stage

Each stage states the ideal experience, what makes it fun (not just functional), and what the pet does. The journey rule underneath all nine stages: the pet is the constant. Screens change around it. The rider never feels handed off between features.

### 1. Discover and install
Ideal: someone hears about the app from a friend, a post, or the App Store page and is inside it in under a minute. The listing leads with the pet and one promise (a calmer ride), not a feature list. Install from the web link or the store adds the same app, same icon, same start screen.
Fun: the store page and the first share card show the pet in mid-breath, mid-bounce, alive, not a static logo. The pet is the reason to tap install.
Pet: the pet is the face of the app everywhere outside it. No separate marketing mascot. One character, everywhere.

### 2. First open and start screen
Ideal: the v1 start screen plays (2.0 to 2.5 seconds, original 4-note motif, skippable after 1 second, panic button visible from 0.0 seconds). By the end of it the rider knows three things: this app is calm, it has a companion, and help is one tap away.
Fun: the motif is the hook. Short, hummable, and identical every time so it becomes familiar fast, the way a sitcom theme does. The pet does a tiny happy bounce as the motif resolves.
Pet: center stage, large, breathing slowly, looking at the rider. First impression is a living thing, not a loading screen.

### 3. Onboarding
Ideal: three screens, not five (v1 cut the feeling screen and the comfort-links screen). Name, then location, then done. Location is one tap: "Use my location" detects the city and its metro system automatically when online, or falls back to a short typed city name. Every screen keeps the "I need help right now" escape. Total time under 60 seconds, and skipping everything still leaves a working app.
Fun: onboarding is a conversation with the pet, not a form. The pet asks the questions in one line each and reacts to answers (a bounce when the name is entered, a happy look when the city is found). Choosing a pet species, if offered, is a moment of delight, not a settings chore.
Pet: the pet asks, listens, and reacts. It introduces itself by name. This is where the rider bonds with it, which is the whole point of the companion strategy.

### 4. Idle and home between rides
Ideal: opening the app between rides feels like checking in with a friend, not opening a dashboard. Home shows the pet, one greeting line, and the dominant panic button. Everything else (ride, toolkit, plan, history, learn) is quiet rows, one tap away. When online, home quietly shows one genuinely useful thing: the rider's usual line status, if known, in one line ("Line 1 running normally"). No feed, no news, no noise.
Fun: the pet has idle life. It blinks, breathes slowly, occasionally does a tiny stretch or looks toward the rider's last tap. On return visits it remembers: after a good ride it celebrates once ("We made it yesterday."). After a hard ride it is simply steady, never chirpy. The pet's memory of the rider is the fun, not gamification. No streaks, no points, no counters.
Pet: greets by name, remembers the last ride in one line, and is available for petting (squash and spring-back, eyes closing happily). Petting is always available and never tracked.

### 5. Pre-ride planning
Ideal: "Start a ride" is three taps. The app knows the city (from onboarding or live detection) and shows the rider's usual line first. With live data, it shows real lines and stations to pick from, plus live status for that line. Without it, the manual flow (city, line, stop count) is unchanged. The rider can set a backup plan (exit stop, person, checklist) once and it is remembered. A one-line confidence note from the pet closes setup ("You have a plan. Mochi is with you.").
Fun: planning feels like packing a bag with a friend. The pet "helps" by holding the plan: the checklist items are things the pet carries for the rider. Completing the checklist gets one happy bounce per item, quiet and satisfying.
Pet: walks the rider through setup in one-line speech, holds the checklist visually, and confirms the plan. The pet is the plan's face, so mid-ride the rider remembers a companion, not a form.

### 6. Mid-ride calm
Ideal: during a calm ride, the app is a quiet companion, not a dashboard. The stop countdown is dominant: one big tap per stop, or automatic advance when live data knows the train's position. The pet sits calmly beside the countdown, breathing slowly. Live line status appears only if something changes ("Delays on Line 1, 10 minutes"). Tools (breathe, ground, comfort) are one tap away behind a single "More" affordance. The screen is dark, quiet, and still.
Fun: the ride itself becomes a small ritual. Each stop tap is satisfying (soft tick, pet micro-reaction). If the rider completes a calm ride, the pet celebrates once at arrival. The ride is not a game, but it has rhythm: tap, breathe, arrive.
Pet: calm, centered, slow-breathing, eyes forward. It mirrors the rider's state: steady when the ride is steady. If the rider opens a tool mid-ride, the pet leads it.

### 7. Mid-ride panic (the sacred moment)
Ideal: identical whether online or offline. Panic button, then the v1 minimal panic screen: three choices, one dominant ("Talk me through it"), under 20 words, crisis line quiet at the bottom. The pet is large, centered, still except for slow breathing, eyes forward. Nothing on this screen depends on the network. Nothing loads, nothing spins, nothing asks for permission. The rescue flow (acceptance, breaths, grounding, close) runs entirely on-device, and the voice is the on-device voice the rider already chose.
Fun: this stage is not fun, and it must not try to be. The "fun" here is trust: the app does exactly what it promised, instantly, every time. The pet's steady presence is the comfort. One deliberate delight is allowed: when the rider taps "I'm steadier," the pet does one slow happy bounce and one line ("You did that."). Relief, not celebration.
Pet: the companion at its most important. Large, breathing in sync with the rescue, looking at the rider, saying one line at a time. This is the moment the whole companion strategy exists for.

### 8. Post-ride reflection
Ideal: arrival shows "I'm home" as the dominant action, then one quiet prompt, not a form: how did that feel, in one word, and did anything help, in one tap. The note is saved on-device and, when sync is on, to the rider's other devices. The pet celebrates once ("We made it."). Total time under 20 seconds. The rider can skip everything and still have the ride logged.
Fun: reflection is a tiny ritual of closure, not homework. The pet's one-line celebration and the one-word feeling make the ride feel complete. Over time, the "What has helped you" card (moved to the toolkit in v1) quietly learns from these notes and surfaces the rider's own best tools, which feels personal rather than algorithmic.
Pet: celebrates once, then settles. It references the ride in one line the next time the rider opens the app, and then lets it go. Memory without nagging.

### 9. Return visits days later
Ideal: opening the app after days away feels like returning to a familiar friend. The pet greets by name, references the last ride in one line if there was one, and otherwise just is there, calm. Home is unchanged: panic button dominant, everything else quiet. If the rider's city has changed (travel), the app notices on location permission and offers the new city's system in one line ("Looks like you're in Milan now. Want the Metro?"), never auto-switching without asking. Updates arrive silently on calm screens (see the auto-apply decision in section E).
Fun: continuity is the fun. The pet remembers, the plan persists, the tools the rider liked are one tap away. A rider who returns after a hard week finds the same calm companion, not a redesigned stranger. Seasonal touches are allowed on brand surfaces only (a winter scarf on the pet in December, for example), never in panic flows.
Pet: the reason to come back. It greets, remembers, and stays steady. Over months, the rider's relationship is with the pet, and the tools are things they do together.

## B. Online features now unlocked, ranked by value

Ranked honestly. Rank 1 earns the top spot because it fixes the owner's own complaint (Italy: every town had a system, the app had nothing) and because it transforms the app from a generic coping tool into a transit companion that knows where you are.

### 1. Live transit data and GTFS-realtime for world metros
What it is: the app detects the rider's city and metro system, loads its lines, stations, and live status, and uses live position data to advance the stop countdown automatically and warn of delays or disruptions.
What it replaces or adds: replaces the bundled TTC-only dataset and the manual stop-count ritual as the default. Manual entry stays as the fallback and as the offline mode. Adds the single biggest missing capability: the app finally knows the rider's actual transit system anywhere in the world.
Offline fallback: the last downloaded city dataset stays cached on-device. If the network drops mid-ride, the countdown reverts to manual taps with one quiet line ("Live tracking paused. Tap each stop."). The rider never loses the ride.
Data notes: GTFS-static feeds are free and public for most major systems; GTFS-realtime availability varies by agency and must be checked per city, not assumed. Start with static schedules and station lists for breadth, add realtime only where an agency publishes it. Italy first in spirit: Rome (ATAC), Milan (ATM), Naples (ANM), Turin (GTT) are the owner's proof cities, but the pipeline must be generic, not hand-built per city.

### 2. Live maps
What it is: a real map view (system map plus the rider's position and line) during ride setup and mid-ride, replacing the TTC-only SVG map.
What it replaces or adds: replaces the hand-drawn TriMap for all cities except as a fallback. Adds orientation: the rider can see where they are on the line, which is calming in itself.
Offline fallback: the last-viewed map tiles and the schematic line diagram (station list as a vertical line) stay cached. If tiles fail, the schematic diagram renders instead, with one quiet line ("Map offline. Line diagram below."). The stop countdown never depends on the map.

### 3. Station search
What it is: type a station name, get matches across the detected city's system, pick it as a start or destination. Fuzzy matching, tolerant of spelling.
What it replaces or adds: adds to ride setup and to the backup plan (exit stop selection). Replaces scrolling through a station list.
Offline fallback: search runs against the cached city dataset. If no dataset is cached for that city, search offers manual entry ("Type your stop count instead").

### 4. Richer voices
What it is: higher-quality spoken guidance for breathing cues, stop announcements, and the "Talk me through it" rescue, using a cloud voice service when online, instead of only the device's installed voices.
What it replaces or adds: adds to the existing on-device voice. The device voice remains the default and the offline voice. The rider picks a preferred voice once; the app uses the cloud voice when online and falls back silently when not.
Offline fallback: device speech synthesis, exactly as today. The rescue flow never waits for a cloud voice. If the cloud voice fails mid-sentence, the device voice takes over at the next cue, never mid-word.

### 5. Real trip sharing with live status
What it is: the rider's trusted contact gets a live trip page (route, live position or last known stop, ETA, and an "I'm home" all-clear) instead of today's static trip card with an upfront ETA.
What it replaces or adds: replaces the static trip card as the online default. The static card remains the offline version.
Offline fallback: the static card (route plus ETA, generated while on signal before going underground), exactly as today. The contact sees "last updated" time honestly, never a stale position presented as live.
Privacy rule: trip sharing is opt-in per ride, contacts only, and the rider picks the contact each time or from a saved person. No always-on location sharing, no background tracking. This is a decision for the owner (section E).

### 6. Cloud sync of preferences and history
What it is: the rider's profile (name, pet species and name, preferred tools, backup plan, city) and ride history sync across the rider's devices, so a new phone or a laptop test setup feels familiar immediately.
What it replaces or adds: adds to today's on-device-only storage. Nothing is removed; local storage remains the source of truth, sync is a copy.
Offline fallback: everything works from local storage. Sync resumes silently when the network returns. Conflicts resolve as last-write-wins per field, with no prompts mid-ride.
Privacy rule: this is the accounts decision (section E). Options are (a) no accounts, sync via an anonymous device-pairing code, or (b) a minimal account (email only). The owner must choose. No analytics, no tracking, no advertising identifiers under either option.

### 7. Embedded comfort feeds
What it is: calm content (cute animals, nature, gentle comedy) playable inside the app instead of redirecting out to YouTube, TikTok, or Instagram.
What it replaces or adds: adds to the existing redirect options, which stay. Embedded playback keeps the rider inside the calm space instead of dropping them into an algorithmic feed, which is actively bad for a panicking rider.
Offline fallback: the bundled offline calm cards, exactly as today. Embedded feeds show only when online; offline, the comfort screen shows bundled content with no dead tiles.
Caution: embedding third-party feeds needs API access and content moderation the owner does not have. This ranks last because it is the most work for the least safety value, and because redirecting to YouTube already works. Do not build this before ranks 1 to 3.

## C. The offline floor, stated precisely

These features must work with zero network, on a phone in airplane mode, in a tunnel, with no prior warning. If any of these fails offline, it is a release-blocking bug.

1. The panic screen and all three panic options ("Talk me through it" rescue, "Breathe with me," "Ground me instead").
2. The breathing engine with the pet as the visual guide and the on-device voice.
3. The full grounding toolkit (all interactive tools, not just the list).
4. The crisis line with locale-correct numbers and the findahelpline.org fallback text (numbers are bundled, not fetched).
5. The backup plan (view and edit), the rider's profile, and ride history (read and write, locally).
6. Bundled calm content (offline calm cards).
7. The start screen, the pet, and all navigation, including the calm-time screens.
8. Manual ride flow: manual stop countdown, "I'm home," reflection.

The degradation rule for everything else: when the network drops, the app never shows a spinner, an error banner, or a dead screen. Each online feature degrades to its stated fallback (section B) with at most one quiet line of explanation, and the rider's current task continues uninterrupted. Specifically: a network drop mid-ride never interrupts breathing, grounding, or the rescue flow; it only pauses live tracking, live maps, and cloud sync, each of which resumes silently when the network returns. If the network drops during ride setup, setup continues with cached data or manual entry, and the rider is told once, quietly, that live data is unavailable.

## D. What this change kills or simplifies from v1

1. **Manual stop-count entry becomes optional, not the default.** When live data exists for the rider's city, the countdown advances automatically. Manual taps remain as the fallback and as a ritual for riders who prefer them. The "one tap per stop" language stays, but it is no longer the only way.
2. **Bundled TTC-only data is replaced by a live-data layer.** The TriMap SVG and ttc.json stop being the transit model and become the offline fallback for Toronto only. The transit model becomes: detect city, fetch or use cached GTFS-static data, render a schematic line diagram from that data. No more hand-built city datasets.
3. **The "no backend" constraint softens to "no backend required."** The app still works fully offline, but it may now call transit data APIs, a voice service, and a sync service when online. The constraint that survives: no backend call may sit on the critical path of a panic flow. Ever.
4. **City themes stop being hand-made.** The 5 hand-made themes become a seed set. New cities get a generated theme (palette derived from the agency's line colors, pet accessory optional) rather than a hand-designed theme each. Hand-made themes remain for the cities the owner cares about most.
5. **The storage model gains a sync layer, but local-first stays.** Local storage remains the source of truth. Sync is additive. The storage migration discipline from v1 (never break existing keys, test upgrades) now also covers sync conflicts, and the rule is last-write-wins per field, no prompts.
6. **The payload budget changes.** The 330KB offline budget still governs the offline floor (everything in section C must fit in it). Online assets (map tiles, cloud voices, city datasets) are cached on demand and do not count against it, but the app must cap its cache and evict old city data, or a frequent traveler's phone fills up.
7. **What does NOT change:** the sacred panic and crisis flows, the pet zero-maintenance rule, clinical honesty, locale-correct crisis numbers, the minimalism audit, the pet-as-companion design, and the start screen spec. The law change is about capability, not about values.

## E. Revised build order and owner decisions

### Revised build order
1. **Phone-frame preview (v1 phase 1, unchanged).** Half a day, near-zero risk, unlocks laptop testing for everything after it.
2. **Minimalism pass, phase 1: panic, home, breathe (v1 phase 2, unchanged).** The offline floor screens get minimal first, because they are the ones that must work in a tunnel.
3. **Pet engine (v1 phase 3, unchanged).** Single-timer breath sync, blink, pupil tracking, reactions. Still the risky one, still tested on the breathe screen first.
4. **Live transit data layer (new, v2).** City detection plus GTFS-static ingestion for one new city end to end (London suggested as the first proof city, Rome second as the owner's proof of the Italy fix), with the cached offline fallback and the manual-tap degradation. This is the highest-value online work and it should land before any other online feature.
5. **Pet-led copy rewrite and minimalism phase 2 (v1 phases 4 and 5, unchanged).** Remaining screens, then the start screen (v1 phase 6).
6. **Live maps and station search (new, v2).** Built on the transit data layer, with the schematic-diagram fallback.
7. **Richer voices, trip sharing, cloud sync (new, v2, in that order).** Voices first (smallest risk), trip sharing second (needs the privacy decision), sync last (needs the accounts decision).
8. **Embedded comfort feeds (new, v2, last).** Only if ranks 1 to 6 are solid and the owner still wants it.
9. **Full regression pass (v1 phase 7, expanded).** Dead-button audit, storage upgrade test, offline-floor test (airplane mode, every floor feature), online degradation test (network dropped mid-ride, mid-setup, mid-rescue), reduced-motion test, real-phone test on the owner's and Div's phones. Nothing ships without this.

### Decisions only Aaryan can make
1. **Accounts or no accounts for sync.** Anonymous device-pairing code (no account, no email, harder to recover) versus a minimal email-only account (easier recovery, more responsibility). This decides the shape of rank 6 and must be settled before it is built.
2. **Trip sharing scope.** Opt-in contacts only per ride (recommended) versus a standing trusted-contact list. And whether the live trip page is a public link or a code-gated page.
3. **How aggressive are the v1 cuts?** (Carried from v1.) Hide-behind-one-tap versus delete outright for "What has helped you," Learn placement, featured toolkit row, saved-links management.
4. **The motif feeling.** (Carried from v1.) Warm rise and resolve, playful bounce, or near-silent. He should hear all three before choosing.
5. **Splash frequency.** (Carried from v1.) Every cold open versus once per day, and the 3-opens-a-day shortening rule.
6. **Which cities first for live data.** London first is the recommendation (biggest GTFS coverage, English-language agency docs), Rome second (the owner's proof city for the Italy fix). He can reorder, but the pipeline must stay generic.
7. **The one-sentence test, updated.** After the minimalism pass and the first live-data city, he opens the app on his phone in a new city and answers two questions: does it feel minimal, and does it know where I am? Both must be yes before the rest of the online work proceeds.

*End of v2 addition. Next step: Aaryan approves (or edits) v1 plus v2. No code is written from either until he does.*
