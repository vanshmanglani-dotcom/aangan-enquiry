# Aangan Studio — Phone Enquiry System

Vaani (Riya voice agent) → post-call webhook → Gemini Flash (classify + route) → Supabase (call log)
→ Telegram (designer handoff, YES/UNSURE) → HubSpot (deal, YES) → Vercel dashboard (calls, qualified %, cost).

## Setup
1. Supabase → SQL Editor → run `supabase/schema.sql`.
2. Vercel → import this GitHub repo → add env vars from `.env.example`.
3. Vaani → agent → post-call webhook URL: `https://<vercel-app>/api/vaani-webhook?secret=<WEBHOOK_SECRET>`.
4. Telegram: create bot via @BotFather, add it to the designers' group, put token + chat id in Vercel.

## Rules baked in
- No firm quotes (The Cut) — enforced in the Vaani prompt.
- Only YES/UNSURE reach designers; UNSURE routes to human review.
- Dashboard shows tool cost (Vaani per-minute + Gemini tokens) so Nikhil never counts manually.
