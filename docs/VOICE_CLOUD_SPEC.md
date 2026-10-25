# REMOVED (v35) — voice work is cancelled by owner decision

> Status: REMOVED in v35. No speech output remains in the app: no device
> voices, no picker, no spoken cues, no cloud TTS. The pet guides with
> on-screen text and speech bubbles only; all sound comes from sound.js.
> The rest of this file is kept as history only and describes a system
> that must NOT be built. See REPORT.md in the repo root (v35 audio
> workstream) for the removal patch list.

---

# Voice layer two spec: opt-in cloud TTS (v34 spec only, NOT built)

Status: spec only. v34 ships device-voice casting only (layer one). No API keys,
no network voice calls, no vendor SDKs are in the app. This document exists so
layer two can be built later without re-deciding the rules.

## Why

Device voices (layer one) are offline and private, but they sound like the
phone, not like a friend. The owner asked for a voice "more real and fun, like
Boardy" (an Australian-accented voice agent). A cloud neural TTS voice can get
much closer to that. It must never weaken the offline core.

## Rules (non-negotiable)

1. Opt-in only, from a calm-time settings screen. Off by default.
2. Device voice stays the offline fallback. If the network is gone, slow, or
   the cloud call fails, the pet speaks with the device voice immediately —
   never a spinner, never silence, never a panic-screen failure.
3. Panic and crisis flows never depend on the cloud voice. The breathing
   count-ins in panic-adjacent flows use the device voice unless the rider
   explicitly enabled cloud voice AND the network is up.
4. No audio leaves the phone except the text being spoken. No ride history,
   no location, no journal, no names. The spoken text is a fixed script
   ("breathe in…", "and out…", "two stops to go") plus the pet's name.
5. No account, no login, no tracking. The key lives server-side only (a thin
   proxy) or in a per-install key the rider pastes in — never in the
   client bundle, never in the repo.
6. The rider can hear the difference before committing: a "Hear the cloud
   voice" preview button plays one line, then asks.

## Provider options (to evaluate when building, not chosen here)

- **OpenAI TTS** (gpt-4o-mini-tts): natural voices, cheap per character,
  simple API. Voice choice is fixed personas, not arbitrary accents.
- **ElevenLabs**: the most human-sounding voices, voice cloning available
  (do NOT clone a real person's voice without consent — use a stock voice).
  Higher cost, streaming latency is good.
- **Google Cloud TTS** (Chirp / Neural2): strong en-AU voices, good pricing,
  Google-grade reliability. Less "character" than ElevenLabs.
- **Azure Neural TTS**: strong en-AU catalog, enterprise reliability,
  mid-range pricing.

Evaluation criteria, in order: en-AU naturalness, latency to first audio
(target under 800ms), cost at the rider's real usage (a few minutes a day),
and whether the provider stores audio/text (must be opt-out-able or zero-retention).

## Cost shape (rough, to verify at build time)

Cloud TTS is priced per character (roughly $4–$30 per million characters
depending on provider and voice tier). A full ride's worth of spoken cues is
a few hundred characters. Even daily use lands in the cents-per-month range
per rider — but cost is per rider and the app is free forever, so the honest
options are: (a) the rider brings their own key, (b) a capped shared proxy
with a monthly budget and graceful fallback to device voice when the cap
hits, or (c) don't build it. Option (b) with a hard cap and silent fallback
is the only shared-cost shape that respects the free-forever rule.

## Privacy notes

- Spoken text is transient: send, synthesize, play, discard. No logs of
  what was spoken beyond aggregate character counts for billing.
- The proxy must not receive the rider's city, route, or journal. Scripts
  are generic calm lines; the only personalization is the pet's name,
  which the rider can disable ("use 'friend' instead of my pet's name").
- If a provider requires data retention for abuse monitoring, say so in
  the settings screen in one plain sentence before the rider opts in.

## What layer two must NOT do

- Replace the device voice. It is the floor, not a fallback of last resort.
- Speak in panic flows without an explicit opt-in and a live network check.
- Add a login wall, a paywall, or any "voice credits" mechanic. The
  zero-maintenance, free-forever rules apply to the voice too.
