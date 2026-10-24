# I Hate Trains: Second-Layer Audit (anxiety-first)

**Role:** second-layer auditor. This document challenges the redesign spec (v1 minimalism/pet/start-screen plus v2 online-enabled journey), it does not rubber-stamp it. Where it disagrees with the spec, it says so explicitly and why.

**Lens:** "Does this truly help someone having a panic attack?" A panicking rider has tunnel vision, shaky hands, racing thoughts, and often cannot read at all. Every feature below is judged against that person, not against design taste, not against a calm reviewer on a laptop.

**Standing rules this audit keeps:** core panic features work offline; panic and crisis flows stay calm, minimal, zero jokes; pet zero-maintenance rule; clinical honesty (coping tools not treatment, stop-if-difficult guidance, crisis numbers real and locale-correct); no invented users, metrics, or test results.

**One principle the spec underplays, stated up front:** the panic screen layout must never change. A panicking rider navigates by muscle memory and position, not by reading labels. Fixed positions, fixed options, fixed words, every single time. Personalization, reordering, and "smart" suggestions on the panic screen are not improvements. They are sabotage of the one thing a frightened person can rely on: that the button they need is exactly where it was last time.

---

## A. "Truly helps" verdicts on every feature

HELPS means it helps a person mid-panic or prevents the next panic. WEAK means nice, but not doing the core job, or only helping in calm time. HURTS means it actively makes a panic moment worse, or adds a decision, a delay, or a new worry when the rider can least afford one. A feature that is merely nice mid-panic is a failure, not a neutral.

### Panic path

- **"Talk me through it" rescue (eyes-free, scripted): HELPS.** The strongest feature in the app. Zero decisions, voice plus pet motion, scripted flow. It is the only feature that works for a rider who cannot read, cannot choose, and cannot think. Everything else on the panic screen should be judged by whether it gets in this feature's way.
- **"Breathe with me": HELPS, with a hard caveat.** Breathing is double-edged. For many riders it calms; for riders prone to hyperventilation, focusing on breath can amplify the feeling of not getting air. The app must never present breathing as the only path, and the rescue must branch off breathing the moment it is not working (see section E, item 2). The pet-as-breath-signal design is correct: a rider with eyes half-closed follows size, not text.
- **"Ground me instead": HELPS.** Sensory grounding is the most robust acute tool in the app because it occupies the senses instead of asking the rider to think or to control their body. It should always be exactly one tap from the panic screen, in the same position, forever.
- **"Show me something cute" on the panic screen: HURTS.** The v1 spec correctly cuts it. Saying it plainly: cute content mid-panic is avoidance dressed as help, and a redirect out of the app breaks companion presence and drops the rider into an algorithmic feed. Comfort belongs after "I'm steadier," never during escalation.
- **"Start 3-3-3 noticing" as a separate panic row: WEAK.** It is a grounding tool, not a separate decision. The v1 spec correctly folds it inside "Ground me instead." A panicking rider should never choose between two grounding tools.
- **"See my backup plan" on the panic screen: the v1 spec cuts it, and the spec is wrong here.** Not the link, the line. A pre-written plan is a pre-commitment device: it removes decisions. One line on the panic screen ("Your plan: get off at St George, call Priya") costs about 8 words and can be the difference between spiraling and acting. Cut the link, keep the line. This is an explicit disagreement with v1 section B.
- **Panic facts / "it's a panic attack, not danger" explainer: WEAK mid-panic, HELPS in calm time.** Psychoeducation reassures some riders and feels dismissive to others ("you're telling me I'm fine while I feel like I'm dying"). One line maximum on the panic path, full article in Learn only. The v24 feedback item asking for a confront explainer on the panic screen should be implemented as one line, not a screen.
- **Thought check (CBT-style) anywhere near panic: HURTS.** Cognitive restructuring needs the prefrontal cortex, which is exactly what is offline during panic. Asking a spiraling rider to evaluate their thoughts is the wrong tool at the wrong time and can feel like being told their fear is irrational. Calm-time only, never linked from panic, rescue, or breathe screens.

### Toolkit and tools

- **5-4-3-2-1 tap-a-dot: HELPS.** Sensory, tactile, working-memory-occupying, no reading beyond single words. The best grounding tool in the app.
- **Hold-to-tense muscle release: HELPS.** Somatic, physical, no cognition required. Shaky hands can still press and hold.
- **Butterfly tap: HELPS.** Rhythmic, bilateral, tactile. Rhythm is doing real work here (section B).
- **Backward count: HELPS.** Occupies working memory with a task too simple to fail at.
- **Object details: HELPS.** Sensory anchoring with one object. Keep prompts to single words.
- **Category game: WEAK mid-panic.** Semantic retrieval under stress is hard; failing to name categories while panicking adds a failure experience to a panic experience. Calm-time tool. Do not offer it inside "Ground me instead" during an active rescue.
- **Kind words deck: WEAK mid-panic, HELPS after.** Affirmations read as false to a rider mid-spiral. Post-"I'm steadier" is the right home for it.
- **Safe place visualization: WEAK.** Requires sustained imagination, which is unavailable mid-panic for most riders. Keep for calm time.
- **Cyclic sigh and 4-7-8 patterns: WEAK as defaults.** Longer holds and counted patterns are harder to follow than gentle breathing and raise the failure rate. Keep them as options chosen in calm time, never as the rescue default.

### Companion and voice

- **Pet as guide (spec design, if built as specified): HELPS.** Social presence is a real anxiolytic mechanism. A companion that breathes with you, looks at you, and speaks one line at a time is doing something no tool list can do.
- **Pet as it exists today (idle loop, separate timer): WEAK, bordering on HURTS.** A companion that breathes on its own schedule while you struggle to breathe on yours does not feel like presence. It feels like being ignored by the one thing that is supposed to be with you. An unresponsive companion mid-panic is worse than no companion, because it promises presence and delivers decoration. The single-timer fix in the spec is not polish. It is the whole feature.
- **Voice-led rescue: HELPS, but only with redundancy.** Voice is the only channel that works when the rider cannot read. But voice alone is a single point of failure (silent phone, dead voice service, no headphones, public train). Every spoken cue must have a visual twin (pet motion, phase word) and vice versa. Never voice-only, never text-only.
- **Richer cloud voices (v2 rank 4): HELPS, narrowly.** Voice quality matters for presence; a robotic voice breaks the illusion of a companion. But the gain is small next to the risk of a cloud dependency, so the spec's fallback rule (device voice takes over at the next cue, never mid-word) is load-bearing, not decorative.
- **Stop alerts ("Your stop, out loud"): HELPS, and it is underrated.** This attacks anticipatory anxiety, the fear of missing a stop that keeps riders hypervigilant for the whole ride. Reducing vigilance is prevention, not just rescue. One gap: public voice announcements embarrass riders. It needs a quiet mode (pet pulse plus screen flash, no voice) as a first-class option, not a buried toggle.

### Safety and social

- **Crisis line on the panic screen, quiet at the bottom: HELPS.** Correct placement. It is a safety net, not a decision. The crisis screen itself must keep the call action dominant (spec says this; keep it).
- **"Call my person": HELPS as a safety net, WEAK as a panic tool.** Mid-panic, many riders cannot talk. A call button demands a conversation the rider may not be able to have. Add a one-tap pre-written text option next to it ("I'm having a panic attack on the train. I'm okay. Please stay on the line with me.") Texting is lower friction than talking when you cannot speak steadily. Also: the reach-out screen showing "Call {name}" above 988 is correct.
- **Live trip sharing (v2 rank 5): WEAK for the rider, HELPS for the contact.** It comforts the person watching, not the person panicking, and knowing someone is watching can increase self-consciousness. Keep it as a pre-ride opt-in only. Never prompt for it mid-ride or mid-panic. The static trip card (route plus ETA) already covers the real safety case.
- **Backup plan as pre-ride work: HELPS.** Pre-commitment is one of the strongest mechanisms in the app: decisions made calm are decisions not made panicking. The plan deserves its space in calm time. Its one-line form belongs on the panic screen (see above).

### Calm-time and content features

- **Learn tab: WEAK.** Psychoeducation has value, but in a panic app it competes with the core job and can prime anxiety (reading about panic symptoms can make a calm rider start scanning their body). The spec's demotion to a toolkit row is right; going further, Learn should never be linked from home as a tab, and entries should end with an action, not with more reading.
- **"What has helped you" card: WEAK.** Personalization feels good in a demo and competes with the panic button in real life. The spec's move to the toolkit is right. Additional rule: it must never appear until at least three rides have named a tool, or it is an empty promise dressed as insight. No scores, no streaks, already correct.
- **History: WEAK.** Reference value only. Fine buried. One risk: re-reading a bad ride's note can re-trigger rumination. Keep entries one line by default, detail one tap away, and never surface old entries unprompted on home.
- **Reflection: HELPS, mildly.** A closure ritual under 20 seconds, skippable, one word for feeling, one tap for what helped. It earns its place by making the ride feel finished. It loses it the moment it becomes a form. Free-text notes should be opt-in, never the default prompt.
- **Comfort (calm cards, redirects): HELPS after panic, WEAK during.** Redirects out of the app are the problem: YouTube autoplay and Instagram feeds are designed to hold attention, not to calm it. Embedded feeds (v2 rank 7) are better than redirects but only if the deck is finite. Infinite scroll is an anxiety machine and must never appear in this app. Finite deck that ends, then the pet, then done.
- **Onboarding (current 5 screens): HURTS for a first-open panic.** Any setup before help is a barrier. The spec's cut to 3 screens is not aggressive enough (see section E, item 15). Name is the wrong first question: a frightened stranger does not care about names. The only onboarding question that changes function is city. Everything else is deferrable.
- **Start screen (v1 spec): WEAK as specified, with a path to HELPS.** The concept is good (familiar motif, companion first impression). The risk is real: every cold open adds up to 2.5 seconds before help, and a motif heard daily becomes an irritant, not a comfort. The mitigations in the spec (panic button from 0.0 seconds, skippable after 1 second, warm-resume skip, 3-opens shortening) are the whole ballgame. If the panic button is not the largest, lowest, most reachable element on that screen, the start screen is a failure regardless of how charming the motif is. Additional cap proposed in section E: after the first week, the intro defaults to pet-only 0.8 seconds unless the rider opts into the full intro.

### Online features (v2)

- **Live transit data and GTFS (v2 rank 1): HELPS, with two sharp edges.** It kills the largest uncertainty in the app (where am I, what is happening with my line) and it fixes the owner's Italy complaint, which is real. Edge one: live data that is wrong destroys trust, and trust is the app's entire currency. A train held between stations while the app says "next stop" teaches the rider never to believe the app again. Live claims need uncertainty language ("about 2 stops," "last updated 1 min ago"), never false precision. Edge two: disruption alerts are a new anxiety vector. A red "delays on Line 1" banner mid-ride can start the panic it is supposed to prevent. Disruption news must be gentle, plan-changing-only, and never a red banner on a ride screen.
- **Live maps (v2 rank 2): WEAK.** Orientation helps a calm rider. During panic a map is visual noise and a decision surface. Keep maps out of the panic flow entirely and off the trip screen's default view. Schematic line diagram is enough mid-ride.
- **Station search (v2 rank 3): HELPS for planning, neutral mid-ride.** Reduces pre-ride uncertainty. Not a panic feature and should not pretend to be one.
- **Cloud sync (v2 rank 6): WEAK.** Convenience, not help. It serves continuity across devices, which matters to the owner testing on a laptop, but it does not calm a single rider on a single train. Lowest safety value of the online set. Anonymous device pairing is the right shape; accounts add a privacy and login-failure surface for almost no panic-relevant gain.
- **Embedded comfort feeds (v2 rank 7): HURTS if infinite, WEAK if finite and curated.** Agree with the spec's last-place ranking. Add the finite-deck rule: any embedded feed must end. An endless feed in a panic app is a design contradiction.

---

## B. Distraction science applied

Plain mechanisms, no invented studies or statistics. Where the evidence is genuinely mixed, that is stated. The question for each mechanism is not "is this a nice idea" but "does this app use it at the moment it matters."

### 1. Sensory grounding
Attention pulled from internal alarm signals (racing heart, dread) toward external senses (touch, sight, sound). This is the most reliable acute mechanism because it does not require the rider to think, believe, or control anything. Well used: tap-a-dot 5-4-3-2-1, hold-to-tense, butterfly tap, object details. Badly used: any tool that asks the rider to notice their own body state (breath counting for hyperventilation-prone riders, "notice your heartbeat" prompts). Body focus can amplify interoceptive alarm. Rule: grounding tools should point attention outward (dots, objects, taps), never inward, during escalation.

### 2. Working memory occupation
A mind busy with a simple task has less capacity left for catastrophic thoughts. The task must be simple enough to succeed at while panicking and engaging enough to hold attention. Well used: backward count, tracing patterns, tap sequences. Badly used: category game (retrieval too hard under stress, failure adds shame), thought check (requires evaluation, not just occupation), any tool with instructions longer than one line (reading itself consumes the working memory the tool is supposed to occupy).

### 3. Rhythm and predictability
Steady, predictable input (breath pacing, repeated taps, a regular voice cadence) signals safety to a threat system that is scanning for surprise. Well used: the breath engine's slow cycle, butterfly rhythm, the rescue script's fixed order. Badly used: anything variable or surprising mid-panic, including random tool suggestions, surprise alerts, sudden sounds, and layout changes. Predictability is why the panic screen must never reorder. A rider who finds the same button in the same place every time is a rider who does not have to think.

### 4. Social presence
Feeling accompanied reduces felt danger. A voice saying "I'm here," a face looking at you, a hand to hold. This is the pet's entire job and the reason the pet matters more than any tool list. Well used: voice rescue with a present pet, call-my-person, the pet's steady gaze. Badly used, and this is the audit's sharpest point: a pet that does not respond. Presence that ignores you is worse than absence, because it raises the expectation of company and then breaks it. The idle-loop pet is not neutral. It is a small betrayal of the companion promise, repeated every time the rider looks at it mid-panic. The single-timer breath sync is therefore not an animation upgrade. It is a trust repair.

### 5. Novelty without surprise
Gentle novelty reorients attention (a new kind word, a pet micro-reaction, a different calm card). Surprise triggers threat. The line between them is control: novelty the rider chooses (tapping to a new card) helps; novelty imposed on the rider (an alert, a sound, a screen change they did not ask for) hurts. Well used: petting reactions, varied post-panic kind words, seasonal brand touches on home only. Badly used: live disruption alerts mid-ride, update banners on any screen that is not calm, autoplay anything.

### 6. Humour timing
Humour after the peak aids relief. Humour during escalation feels dismissive, and a frightened rider hears dismissal as "you are overreacting." The existing rule (zero jokes in panic and crisis flows, jokes only on brand surfaces) is correct and should be extended: no jokes in the pet's panic-screen lines, no jokes on the rescue script, no jokes on the "I'm steadier" moment itself. The pet's post-panic line ("You did that.") is relief, not a joke, and that distinction matters. Jokes belong on home, onboarding brand copy, and post-ride celebration only.

### 7. Agency and control
Panic is substantially a loss-of-control experience. One clear action, taken successfully, restores a fragment of control. Well used: the big stop tap, "I'm steadier," one-tap tool starts. Badly used: auto-advancing flows with no pause or skip (the rescue script needs a visible "skip this step" or tap-to-advance, or the rider is a passenger in their own rescue), and any flow where the rider cannot tell whether their tap did anything (see section D on feedback immediacy).

### 8. Uncertainty reduction
Not knowing what happens next is itself an anxiety driver on transit: which stop, how long, is this delay normal, did I miss it. Well used: stop countdown, stop alerts, live status handled gently, the backup plan. Badly used: vague copy ("soon," "in a bit," "almost there"), false precision from live data, and any screen that leaves the rider unsure what to do next (dead ends, section D).

### What is honestly uncertain
Whether cute content helps or harms during acute panic varies by person and by moment; the audit's position (post-panic only) is a safety-first judgment, not a proven universal. Whether social presence from a cartoon pet helps adults as much as it helps children is less established than the app's strategy assumes; the pet bet is reasonable but should be validated with real riders, not assumed. Whether breathing helps or harms a given rider during panic is genuinely individual, which is why the branch-off-breathing requirement (section E, item 2) is non-negotiable rather than optional.

---

## C. The hole hunt

Every gap found, including states the first spec did not cover. Each ends with the ideal behavior and whether it is a fix, a new feature, or a deliberate non-goal.

### 1. Opens the app mid-panic with no setup done
Ideal: help first, setup never. The start-screen panic button and every onboarding escape must be the largest, lowest, most reachable element on their screens, not a small "skip" link. After a rescue, the app gently offers setup once ("Want to set up your usual line for next time?"), and accepts no. The app must function fully with zero profile: no name, no city, no plan. A rider with no setup gets the same rescue as a rider with a full profile. Type: fix (escape prominence plus zero-profile guarantee).

### 2. Freezes and cannot choose anything
Ideal: the app chooses for them. If the rider taps "I need help right now" and then taps nothing for about 5 seconds on the panic screen, the app auto-starts "Talk me through it." No prompt, no "are you still there," just the rescue beginning. This is the single highest-leverage change in this audit (section E, item 1). It also covers the helper case (section C, item 16) and the cannot-read case (item 3). Type: new feature, small build, enormous value.

### 3. Cannot read at all in the moment
Ideal: the rescue is fully operable with eyes closed. Voice auto-enables on rescue entry (the tap that opened rescue is the user gesture, so autoplay rules are satisfied). Every spoken cue has a pet-motion twin. Phase words are spoken, not just shown. The rescue's only on-screen text is the phase word and the "I'm steadier" button. Type: fix (voice auto-enable plus spoken phase words).

### 4. Voice fails or phone is on silent
Ideal: redundancy, not error dialogs. If voice fails, the pet and phase words carry the rescue silently with no error message ever shown on a panic screen. If the phone is on silent, the rescue still runs visually; a big mute/unmute button sits inside rescue. The rescue voice must be independent of the global voice toggle set weeks ago in Privacy: a rider who turned voice off in calm time and then panics must still get voice in rescue, with a one-tap mute. Type: fix.

### 5. Battery dies mid-ride
Ideal: nothing the app can do after death, so the mitigation is before death. Design for low drain by default: dark UI, no GPS polling mid-ride, no live map rendering during a ride, no background location. The real safety net is the backup plan and trip sharing: the contact already has the route and ETA, so a dead phone does not mean a missing person. Battery-percentage detection is unreliable on iOS, so do not build features on it. Type: deliberate non-goal beyond low-drain defaults plus the existing trip card.

### 6. Network drops despite the online ceiling
Ideal: the drop is invisible on sacred screens. No "offline" banner, no error toast, no spinner on panic, breathe, rescue, or crisis screens, ever. Live tracking quietly becomes manual taps; live maps quietly become the schematic diagram; sync quietly pauses. One quiet line of explanation is allowed on calm screens only. The spec's degradation rule is right; this audit adds the banner-suppression rule for sacred screens as a hard requirement. Type: fix (rule plus implementation check).

### 7. Pet is silent or missing
Ideal: graceful degradation, never a blank space. If the pet SVG fails to render or the species data is corrupt, fall back to a simple breathing blob with captions and repair the species choice on next launch. If the pet's lines fail to load, the phase words alone carry the exercise. The pet must never be a single point of failure for a breathing exercise. Type: fix (fallback blob plus safe defaults).

### 8. Ride ends early or the user gets off at the wrong stop
Ideal: no failure language anywhere. Getting off early during panic is common and is often the right call. Replace "I'm home" as the only ride-end action with "I'm off" as the primary action: it ends the ride wherever the rider is, without implying they reached their destination or failed. Reflection after an early exit must not ask "what went wrong." It asks the same one-word feeling question as any ride. Type: fix (copy plus action change).

### 9. Panic before boarding and panic after arriving
Ideal: the panic button works identically regardless of ride state, including on the platform before boarding and on the street after arriving. That means the floating SOS must be visible on reflection, history, learn, comfort, plan, and about screens, not just on ride screens. The spec and README describe SOS as present "on every screen except home, panic, and onboarding"; this audit requires it on reflection and calm-time screens too, because post-arrival panic is real and the rider must not have to navigate home first. A pre-boarding mode (quick grounding plus plan review without starting a ride) is a small new feature worth building after the core fixes. Type: fix (SOS coverage) plus small new feature (pre-boarding mode).

### 10. Second panic in the same ride
Ideal: returning to panic is one tap, and the app does not pretend the first panic never happened. Tapping "I'm steadier" returns to the trip screen with tools still one tap away, never to home. If panic recurs within about 10 minutes, the pet is steady only: no celebration bounce, no repeated "You did that" line, no chirpy greeting. A repeated celebration after a relapse feels mocking. Add a celebration cooldown as a rule. Type: fix.

### 11. With a friend versus alone
Ideal: the app serves both without asking which. With a friend, the rider may want quiet mode (visual only, no public voice) and the friend may operate the phone. Alone, the pet and call-my-person matter more. The concrete fix is a quiet-mode preference set in calm time plus a one-tap mute inside rescue, so the rider never has to choose between help and embarrassment on a crowded train. Type: fix (quiet mode plus rescue mute).

### 12. Headphones versus no headphones
Ideal: the rescue never assumes audio is private or available. Default: voice on at low volume with a large mute button, because the tap that opened rescue is the gesture and the rider who cannot read needs voice. But the first time the rider uses rescue in calm time, offer the quiet-mode preference once ("Usually ride with headphones?"). After that, never ask again. The pet's motion is always the primary signal; voice is the companion, not the carrier. Type: fix (low-volume default plus one-time preference).

### 13. Reduced motion on
Ideal: the breath signal survives without scale animation. With reduced motion enabled, the pet communicates phase through a slow opacity shift plus the spoken cue plus a filling dot or ring that does not move spatially. The pet must not go static and unexplained; static with no phase signal strands the rider. This is a distinct breath mode, not just "animations off." Type: fix (reduced-motion breath mode).

### 14. Largest text size
Ideal: the panic screen's 20-word budget must hold at maximum text size, and the dominant button must remain visible without scrolling. Fix by anchoring: primary action fixed to the bottom of the viewport on panic, breathe, and rescue screens, so text growth pushes secondary content, never the action. Test at maximum size on a real phone before shipping; this is a release gate, not a nice-to-have. Type: fix (layout rule plus QA gate).

### 15. One-handed use with a bag in the other hand
Ideal: every primary action lives in the thumb zone (bottom half, full width) on every screen. The floating SOS, the stop tap, "I'm steadier," and the panic button are all bottom-anchored. Nothing critical lives only at the top of the screen. Petting the pet is fine mid-screen because the pet is large and central. The "More" affordance must also be bottom-anchored, or it is unreachable one-handed. Type: fix (thumb-zone audit of every screen).

### 16. The app is opened by someone else for the panicking rider
Ideal: the helper story works with zero knowledge. Friend opens the app, sees the panic button from 0.0 seconds on the start screen, taps it, and if nobody taps anything for 5 seconds the rescue starts itself (item 2). The rescue's second-person copy still works ("breathe with me") because the friend can breathe along and coach. No separate "helper mode" is needed if items 2 and 3 are built. A helper mode would add a decision nobody has time for. Type: covered by fixes, deliberate non-goal as a separate mode.

### 17. Shaky hands and mis-taps
Ideal: mis-taps cost nothing. Every tap target is at least 60px for primary actions and 44px for secondary, with generous spacing between adjacent actions so a shaking thumb does not hit two. Destructive actions (end ride, erase data, close rescue) are never one accidental tap away on panic screens; on calm screens they carry a 3-second undo toast instead of a confirmation dialog. Navigation transitions debounce so a double-tap does not double-navigate. Type: fix.

### 18. Update arriving mid-ride or mid-rescue
Ideal: updates never interrupt a ride. The spec's safe-screens-only banner is correct; this audit adds the hard rule: an update may only apply on home or calm-time screens, never during a trip, a rescue, or a breathing exercise, even if the rider tapped "update" earlier. A forced reload during a panic exercise is an app-caused harm. Type: fix (rule plus implementation check).

### 19. Language: a rider panicking in a language that is not English
Ideal, honestly: the app is English-only today, and a tourist panicking in Milan may not parse English instructions. Short-term mitigation is already partly in place: the rescue relies on pet motion, counting, and single words, which cross languages better than paragraphs. Medium-term, localize the rescue script (acceptance line, phase words, "I'm steadier") for the top metro languages, starting with the v2 proof cities. This is future work, not launch-blocking, but it must be named now because the world-metros push makes it inevitable. Type: future feature, named.

### 20. VoiceOver and screen-reader riders
Ideal: the panic screen is fully VoiceOver-navigable with a sane order: panic button first, rescue options second, crisis line last. Every icon-only control has a label. The pet's breathing state is announced by phase words, not by decorative image descriptions. Add to the release QA gate. Type: fix (QA gate).

---

## D. Interaction-level audit

Judged under panic conditions: tunnel vision, shaky hands, racing thoughts, possible tears, one hand holding a bag or a pole.

### Tap targets
- Primary actions: full width, at least 60px tall, bottom-anchored. This is the existing bar and it must survive the minimalism pass untouched.
- Secondary actions: at least 44px, quiet text links, never competing buttons. The spec's secondary treatment is right.
- The floating SOS: at least 56px, bottom-anchored in the thumb zone, present on every screen except the panic flow itself (see item 9 for the expanded coverage list).
- The pet as a tap target: the whole pet card is tappable for petting, not just the SVG. A rider petting a 60px blob with shaking hands will miss it.
- Spacing: at least 12px between adjacent tappable elements on panic and ride screens. A mis-tap that starts the wrong tool mid-panic costs the rider their remaining composure.

### Feedback immediacy
- Every tap must produce visible feedback within 100ms: a scale press, a color flash, or a tick sound. This is non-negotiable on the panic button and the stop tap. If the app takes 300ms to transition, a panicking rider taps again, and a double-tap that double-navigates strands them on the wrong screen.
- The panic button's press state must be instant and obvious even before navigation completes. Navigation transitions must debounce: one tap, one navigation, regardless of how many times the button is hit in the next second.
- Tool completion must acknowledge instantly (pet micro-reaction plus one line), not after a delay or a summary screen.

### Dead ends (screens with no obvious next step)
Each of these is a real dead end or a near miss in the current app or the spec:
- Reflection after skipping: "skip" must go home, never to a blank state.
- Tool completion: must offer "back to ride" or "done" in the same position every time, not a screen that just ends.
- Backup plan save: must confirm in one line and return to the previous screen. A save with no confirmation reads as a failure.
- Learn read end: must offer "back" plus "try the tool," not an article that just stops.
- Onboarding last screen: must go home, never loop back to screen one.
- History empty state: must show the pet plus one line ("No rides yet. That's fine."), never a blank list.
- Comfort after a redirect returns: the rider comes back from YouTube to a comfort screen that must still show the pet and the panic button, not a dead external-browser handoff.
- Update banner dismissed: the banner must not reappear on the next calm screen like a nag. Once dismissed, it waits until the next version.

### Waiting states
- Any spinner on a panic, breathe, rescue, or crisis screen is a release-blocking bug. There is no acceptable loading state on a sacred screen. Content is bundled; if it is not bundled, it does not belong on that screen.
- On calm screens, cached content renders first, never a blank screen plus a spinner. Geolocation "trying" state must show honest text plus manual entry immediately available, never a spinner alone.
- Live data loading on ride setup must show the cached or manual flow instantly, with live data filling in when it arrives. The rider never waits for the network to start a ride.

### Error states
- Geolocation denied: settings guidance, honest, no blame (spec covers this; keep it).
- Network failure: quiet line on calm screens only, never a banner on sacred screens (item 6).
- Voice failure: silent fallback to visual, no error dialog, ever, on a panic screen.
- Storage corrupt or full: safe defaults, full functionality, no crash to blank. A corrupt profile must never produce a white screen; it must produce the zero-profile rescue path.
- Update failure: silent. The old version keeps working. The rider is never told an update failed.
- Wrong city detected: one-tap correction ("Not Toronto?"), never an accusation and never a forced re-onboarding.

### Copy: the panic path, word by word
The spec's budget is 20 words on the panic screen. Here is a concrete draft that meets it, offered as the target:
- "You're safe. This will pass." (5 words: reassurance plus the true, time-limited nature of panic)
- "Talk me through it" (4: the dominant action)
- "Breathe with me" (3), "Ground me instead" (3: the two secondaries)
- Crisis line, quiet: "988, call or text" (4, locale-adjusted)
- Total: 19 words. The backup-plan line (item 4, section A) would push this over budget; the resolution is that the plan line replaces the reassurance line when a plan exists ("Your plan: get off at St George, call Priya" is the reassurance, personalized). One line, not two. That is the honest trade.
- Words challenged and removed: "Show me something cute" (a decision disguised as comfort), "See my backup plan" (a link where a line belongs), "Start 3-3-3 noticing" (jargon plus a number the rider must parse), any sentence longer than 8 words on a running tool screen, and any copy that describes the app instead of guiding the rider ("Welcome to your toolkit" helps nobody mid-panic).
- Button labels must be verbs of action, not nouns. "Breathe with me" is good. "Toolkit," "Comfort," and "History" are labels for calm time, never for panic time.
- Gesture rules: taps only on the panic path. No swipe-only actions anywhere critical, and no swipe-back on panic or rescue screens (a panicking rider's shaking thumb swipes accidentally; an accidental swipe that exits the rescue is a harm).

---

## E. Ranked cut/fix list

Ordered by leverage for a person having a panic attack. This list is allowed to disagree with the first spec; disagreements are marked DISAGREES.

1. **Auto-start the rescue after 5 seconds of no choice on the panic screen. (ADD)** The single highest-leverage change. It covers freezing, helper operation, cannot-read, and cannot-decide in one behavior. If the rider taps panic and does nothing, the app does the kindest thing it can: it starts helping without asking again.
2. **One-tap "this isn't working" branch inside the rescue. (ADD)** Breathing fails for real riders. When it fails, the rescue must branch to grounding without a menu, a question, or a restart. A small "try grounding instead" action, always visible during breath phases, or automatic branching if the rider taps "stop" twice. No rider should have to escape a failing exercise to find a working one.
3. **Panic screen fixed layout, fixed words, fixed positions, forever. (FIX, extends the spec)** The spec's 20-word budget is right; this audit adds permanence as a rule. No personalization, no reordering, no A/B tests on the panic screen. Muscle memory is a safety feature.
4. **One-line backup plan on the panic screen. (ADD, DISAGREES with v1 section B)** Cut the link, keep the line. Pre-commitment only works if it is visible at the moment of crisis.
5. **Remove cognitive tools from all panic paths. (FIX)** Thought check and panic-facts articles are calm-time only. No links from panic, rescue, or breathe screens. This includes the v24 "confront explainer" request: one line maximum on the panic path.
6. **Remove comfort and all outbound redirects from the panic screen. (FIX, agrees with the spec)** And extend it: comfort becomes a post-"I'm steadier" destination, not a parallel option. Redirects during panic break companion presence.
7. **Rescue voice independent of the global voice toggle, auto-on at low volume, big mute inside rescue. (FIX)** A setting chosen in calm time must never silently remove voice from a rescue. Quiet mode is a calm-time preference, not a rescue-time surprise.
8. **"I'm off" replaces "I'm home" as the ride-end action. (FIX)** No failure language for early exits. Getting off early is often the right call and must never be framed as failing the ride.
9. **No banners, spinners, or error dialogs on sacred screens, ever. (FIX, hard rule)** Includes update banners, offline banners, and voice-error dialogs. Sacred screens are panic, breathe, rescue, crisis, and the start screen's panic button.
10. **Stop-alert quiet mode. (ADD)** Pet pulse plus screen flash, no public voice. Embarrassment is a real barrier to using the app on a crowded train.
11. **One-tap text-my-person alongside call-my-person. (ADD)** Talking is hard mid-panic. Texting is not.
12. **Celebration cooldown. (FIX)** No repeat celebration if panic recurs within 10 minutes. The pet is steady, not chirpy, on a second panic.
13. **Live data honesty rules. (FIX to v2 rank 1)** Uncertainty language on every live claim ("about 2 stops," "last updated 1 min ago"), and disruption news delivered gently and only when it changes the rider's plan. Never a red banner on a ride screen.
14. **Finite comfort decks, never infinite scroll. (FIX to v2 rank 7)** Any embedded feed must end. An endless feed in a panic app is a contradiction.
15. **Onboarding: name optional, escape dominant, city is the only required question. (FIX, DISAGREES with the spec's 3-screen name-first order)** The spec's cut from 5 to 3 screens is good but still asks the wrong first question. One screen if possible: city plus optional name inline, with an escape button as large as any other action on the screen.
16. **Reduced-motion breath mode, max-text-size layout gate, VoiceOver order, thumb-zone audit. (FIX, QA gates)** Each is a release gate, not a backlog item. The pet must signal phase without scale animation; the dominant button must survive maximum text; VoiceOver order must be panic button first; every primary action must be thumb-reachable.
17. **Start screen frequency cap. (FIX, DISAGREES slightly with the v1 spec)** After the first week, the intro defaults to pet-only 0.8 seconds unless the rider opts into the full intro. "Every cold open at 2.5 seconds" becomes an irritant with daily use, and an irritant at the door of a panic app is a reason not to open it.
18. **Learn stays buried, calm-time only, action-ending entries. (FIX, agrees with the spec's demotion)** Plus the priming caution: reading about panic symptoms can make a calm rider start scanning their body. Entries stay short and end with a tool, never with more reading.
19. **Sync last, anonymous pairing only until the owner decides otherwise. (FIX, agrees with v2 order)** Sync serves the owner's laptop testing more than it serves a panicking rider. It must not jump the queue ahead of items 1 through 12.
20. **Cuts to execute, not just hide. (CUT, agrees with the spec)** Featured toolkit row, 3-3-3 as a separate panic row, timer display on the breathe screen, duration from ride setup, comfort saved-link management from the main view, "What has helped you" from home. Hiding is the spec's mitigation; for these six, hiding is enough only if the hidden location is genuinely one tap away, or the cut is effectively a deletion for a panicking rider. Verify each hidden location is reachable in one tap from a calm screen, or cut outright.

### What the first spec got right (kept, not relitigated)
The 3-option panic screen, the 20-word budget, pet-led copy replacing paragraphs, the offline floor, the no-spinner degradation rule, celebration restraint, the quiet crisis line, the single-timer pet breath sync, and the panic button visible from 0.0 seconds on the start screen. This audit builds on those. It does not reopen them.

### The one-sentence verdict
The redesign spec is a good design document that is still, in places, designing for a calm reviewer rather than a frightened rider. The highest-leverage change is not a visual one. It is behavioral: when a rider taps "I need help right now" and then freezes, the app must start helping on its own after five seconds, because the riders who need this app most are the ones least able to choose how to be helped.
