# Services used by QuizMint

Quick reference for every external service this project depends on, what it does, which tier we're on, and when anything expires.

Last updated: **2026-04-25**

---

## Vercel — hosting & serverless functions
- **What it does:** hosts the Vite build, runs the `/api/*` functions (generate, account delete, cron cleanup), runs the daily cron job.
- **Plan:** Hobby (free).
- **Expires:** never (no paid subscription).
- **Limits that matter:**
  - 300s default function timeout (plenty).
  - Cron jobs limited to **daily** on Hobby — our cleanup cron runs once a day at 03:00 UTC.
  - 4.5 MB max request body size.
- **Deploy policy:** manual only via `vercel --prod`. GitHub is intentionally **not** linked.
- **Dashboard:** https://vercel.com/yashrajs-projects-82d81fc8/quizmint

## Supabase — auth + storage
- **What it does:** user auth (email + password, password reset, email-change, password recovery), Postgres storage, and file storage for PDFs uploaded for vision processing (bucket `user-uploads`).
- **Plan:** Free tier.
- **Expires:** never (no paid subscription).
- **Limits that matter:**
  - 500 MB database / 1 GB file storage (we only store transient uploads that get deleted after generation).
  - Project auto-pauses after **7 days of inactivity** on free tier. In practice our daily `/api/cron/cleanup-uploads` job hits Supabase Storage every 24h and counts as activity, so the pause timer never reaches 7 days as long as that cron is running. If you ever disable or remove the cleanup cron, the pause risk comes back — either re-enable it, or add a lightweight ping cron.
- **Dashboard:** https://supabase.com/dashboard

## Resend — transactional email (SMTP for Supabase)
- **What it does:** sends Supabase's auth emails (signup confirmation, password reset, email-change) from `noreply@quizmint.me`. Supabase is configured to use Resend's SMTP endpoint (`smtp.resend.com:465`).
- **Plan:** Free tier.
- **Expires:** never (no paid subscription).
- **Limits that matter:**
  - 100 emails/day, 3,000/month on free tier.
  - 1 custom domain (we use `quizmint.me`).
- **DNS records** added to Namecheap for this to work:
  - `MX send` → `feedback-smtp.ap-northeast-1.amazonses.com` (priority 10)
  - `TXT send` → `v=spf1 include:amazonses.com ~all`
  - `TXT resend._domainkey` → DKIM public key (long p=… blob)
  - `TXT _dmarc` → `v=DMARC1; p=none;`
- **Dashboard:** https://resend.com/domains

## Namecheap — domain registrar
- **What it does:** registers `quizmint.me`, hosts the DNS zone (A → Vercel, MX/TXT → Resend).
- **Plan:** free via **GitHub Student Developer Pack** (1-year `.me` registration).
- **Expires:** **2027-04-21** (1 year from registration). Renewal after that is paid (~$10–20/year).
- **Security to keep on:**
  - 2FA on the Namecheap account (authenticator app, not SMS).
  - Registrar Lock = ON (prevents transfers out).
  - WhoisGuard / Domain Privacy = ON (hides personal info from public WHOIS).
- **Dashboard:** https://ap.www.namecheap.com/domains/list/

## Google AI Studio — Gemini API
- **What it does:** powers quiz generation (model: `gemini-3-flash-preview`). We rotate through 5 keys (`GEMINI_API_KEY`, `_2`–`_5`) in Vercel env to spread free-tier quota.
- **Plan:** Free tier per project.
- **Expires:** never (no paid subscription).
- **Limits that matter:**
  - 20 requests/day/model per project on free tier. That's why we have 5 keys — each gives us another 20.
  - User can also plug in their own key via the UI (stored in localStorage, never sent to our server) to bypass our quota entirely.
- **Dashboard:** https://aistudio.google.com/apikey

## GitHub Student Developer Pack — domain freebie
- **What it is:** student benefits bundle, got the Namecheap `.me` domain through this.
- **Expires:** student verification lasts 2 years from approval, renewable while still a student. Pack itself doesn't expire, but individual offers (like the domain) are one-time.
- **Dashboard:** https://education.github.com/pack

---

## Renewal calendar

| Date          | What expires                                   |
|---------------|------------------------------------------------|
| 2027-04-21    | `quizmint.me` domain (Namecheap)               |
| when inactive | Supabase project (auto-pause after 7 days idle — mitigated by daily cleanup cron) |

Everything else is free-forever as long as we stay within limits.
