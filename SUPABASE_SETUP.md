# I Hate Trains v35: Supabase setup (owner steps)

Status: NOT provisioned. Nothing in this workstream creates a project,
an account, or a charge. The app ships guest-first, and the account
UI honestly says accounts are coming until the owner approves the
steps below and the coordinator pastes in a real config.

## The decision needed, stated plainly

Supabase Pro costs $25 per month at launch. The free tier is
disqualified for production, not just tight: free tier projects pause
after 7 days idle, which would lock riders out of sync and sign in
for no reason other than a quiet week. Validate on the free tier if
you want a hands-on test, then move to Pro before any public launch
that promises accounts. Do not launch accounts on the free tier.

Decision for the owner, in one line: approve Supabase Pro at $25 per
month for launch, or approve free tier validation only, with accounts
staying labeled coming soon in production until Pro is live.

## Exact setup steps (owner, in order)

1. Create a project at supabase.com/dashboard. Name it something
   obvious, for example `i-hate-trains`. Pick the region closest to
   Toronto riders. Note: do not put the service role key anywhere in
   the app, in this repo, or in a chat message. The browser uses only
   the publishable anon key.
2. Open the SQL Editor in the new project. Paste the full contents of
   `supabase/migration.sql` and run it. Confirm three tables exist:
   `profiles`, `user_data`, `account_deletion_requests`, each with
   row-level security enabled.
3. Go to Authentication, then Sign In Providers. Turn on Email and
   confirm magic link (one-time password email) is allowed. This is
   the fallback path in auth.js.
4. In the same Providers list, turn on Apple and Google. Apple needs
   an Apple Service ID and key from developer.apple.com; Google needs
   an OAuth client from console.cloud.google.com. Each provider page
   in Supabase lists the exact fields. There is no shortcut here, and
   neither provider works until its own console setup is done.
5. Still in Authentication, go to URL Configuration. Set the Site URL
   to the production app URL, and add that same URL to Redirect URLs.
   Without this, OAuth and magic links bounce instead of signing in.
6. For passkeys: after a first sign in, auth.js enrolls a WebAuthn
   factor through Supabase Auth MFA (factorType `webauthn`). That
   means passkeys unlock return visits; they do not replace the first
   sign in. Confirm in Authentication, then Policies, that MFA
   enrollment is allowed for signed-in users before promising
   passkey-only sign in to anyone.
7. Copy the Project URL and the anon key from Project Settings, then
   API. Give them to the coordinator privately, never in a public
   issue or commit. The coordinator replaces only the two placeholder
   values in the Snippet D config block (`YOUR-PROJECT` URL and
   `YOUR-SUPABASE-ANON-KEY`) and pastes the snippets from
   `v35-accounts-snippets.html`.
8. Test in this order, on a real phone: guest mode works with no
   config change needed; sign in with Apple; sign out; sign in with
   Google; magic link; add a passkey; sign out and return with the
   passkey; sync; request deletion and confirm the row appears in
   `account_deletion_requests` with status `pending`.
9. Handle deletion requests as an owner job: a pending row means a
   rider asked to be forgotten. Delete that user's rows from
   `profiles` and `user_data`, delete the auth user, then mark the
   request `completed`. Do not automate this until the owner says so.

## What provisioning unlocks

- Cross-device sync: co-rider, name, city, line, preferences, backup
  plan, ride notes, trips, and saved comfort links follow the rider
  to a new phone.
- Backup: a lost or replaced phone stops being a total reset.
- Sharing readiness: a real user base is the precondition for any
  future trip sharing feature. Sharing itself is not built here.

## What stays local until then (and after, by design)

- Panic help, breathing, grounding, and every coping tool: fully
  local, fully offline where it matters, never gated by login.
- Guest mode: the default, forever, with no nagging and no countdown.
- The backup plan contact phone number: never synced, even after
  provisioning, because it belongs to someone else.
- Everything already on a guest phone stays on that phone until that
  rider signs in and taps Sync. Provisioning alone moves nothing.

## What this workstream deliberately does not do

- No paid service is provisioned, no account is created, no money is
  spent, and no real credential is written anywhere in these files.
- No revenue-shaped work: accounts are free, there is no paywall,
  no premium tier, and no upsell copy anywhere in the account UI.
- No fake login: an unconfigured build disables sign in buttons and
  labels them coming soon, instead of pretending to sign anyone in.
