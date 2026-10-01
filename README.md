# Security Detail Radio

Push-to-talk radio PWA for the church Security Detail team. iPhone and Android, installed from the browser.

Stack: React + Vite + TypeScript, Supabase (auth, database, storage, realtime), LiveKit Cloud (live audio), Netlify (hosting + functions). Three camouflage skins (Woodland, Desert, Urban), switchable in Settings and saved per person.

## What it does

- Hold-to-talk on channels, one talker at a time. Team leads can talk over a member. 60-second limit per call.
- Every call is recorded, transcribed, and translated EN/ES (optional keys). Replay from the Log.
- SOS key: hold 3 seconds. Full-screen alarm for everyone with the app open, push alert to every phone, GPS attached.
- Team roster with live status (on duty, app open, alerts only, offline). Leads can ping a member's phone.
- Command dashboard at /command for leads: live call feed, posts, team broadcast, incidents, members, channels.

## Setup

1. Supabase: create a project, open the SQL Editor, run `supabase/migrations/001_security_radio.sql`.
2. LiveKit Cloud (livekit.io): create a project. Copy the WebSocket URL, API key and API secret.
3. Push keys: run `npx web-push generate-vapid-keys`.
4. Optional: OpenAI key (transcripts) and Anthropic key (translation).
5. Netlify: add every variable from `.env.example` BEFORE the first build. Server-only keys never get a VITE_ prefix.
6. Push the repo to GitHub and connect it in Netlify. Build settings come from `netlify.toml`.
7. Open `https://your-site/setup`, enter BOOTSTRAP_SECRET, church name, team code, your callsign and PIN.
8. Delete BOOTSTRAP_SECRET from Netlify and redeploy.
9. Sign in, open Settings, tap Open command dashboard, and add members. Each gets a one-time activation code. They choose their own PIN.
10. Each member: open the site on their phone, Add to Home Screen (required on iPhone), sign in, Settings, Turn on alerts.

## Known limits

- iPhone cannot play live audio while the screen is locked or the app is in the background. Shift mode keeps the screen awake. Locked phones still get SOS alerts and can replay calls from the Log.
- Headset button to talk is beta and depends on the headset.
- Transcripts arrive a few seconds after a call ends.
- Recorded audio is deleted after RETENTION_DAYS (default 30). Transcripts stay.

## Scripts

- `npm run dev` - local dev (functions need `netlify dev`)
- `npm run build` - typecheck and build
- `npm run typecheck:functions` - typecheck Netlify Functions
