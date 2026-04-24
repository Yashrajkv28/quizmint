# Auth Email Callback (Token-Hash Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Supabase auth emails from linking to `*.supabase.co` (which trips Gmail/Outlook spam filters because the sending domain is `quizmint.me`). Switch to the token-hash flow so links point at `https://quizmint.me/auth/callback`, and a client route exchanges the token for a session.

**Architecture:** Supabase email templates are changed from `{{ .ConfirmationURL }}` → `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=<kind>`. A new lightweight React page (`AuthCallback.tsx`) reads the params, calls `supabase.auth.verifyOtp({ token_hash, type })`, strips the URL, and lets the existing `AuthProvider` listener handle routing (signed-in session → dashboard; `PASSWORD_RECOVERY` event → reset page). `App.tsx` picks up the new path via a `pathname` check — no router library added. `vercel.json` gets an explicit SPA rewrite so the sub-path always serves `index.html`.

**Tech Stack:** React 19, Vite 6, `@supabase/supabase-js` v2 (already installed), Vercel static hosting, plain `fetch`/`history` APIs — no new deps.

**Testing approach:** No automated test suite exists in this repo. Each task ends with a manual verification step (build, dev-server smoke, or real-email round-trip) instead of unit tests. Do **not** add a testing framework — that's outside scope per CLAUDE.md instructions.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/components/AuthCallback.tsx` | **Create** | Parses `token_hash`/`type` from URL, calls `verifyOtp`, renders status + error. |
| `src/App.tsx` | Modify (top of component) | Short-circuit render `AuthCallback` when `pathname === '/auth/callback'`. |
| `src/lib/auth.tsx` | Modify (L56, L72) | Point `emailRedirectTo` / `redirectTo` at `/auth/callback`. Safety net only — the template `{{ .SiteURL }}` is authoritative. |
| `vercel.json` | Modify (add `rewrites`) | Serve `index.html` for any non-`/api/*` path so `/auth/callback` isn't a 404. |
| `docs/email-templates/confirm-signup.html` | Modify (L48, L57) | Swap both `{{ .ConfirmationURL }}` references for the token-hash URL (`type=signup`). |
| `docs/email-templates/reset-password.html` | Modify (L44, L53) | Same swap, `type=recovery`. |
| `docs/email-templates/change-email.html` | Modify (L44, L53) | Same swap, `type=email_change`. |
| `NEXT_SESSION.md` | Modify (P0 list) | Mark P0-1 done, move OG metadata to top. |

---

## Task 1: Add SPA rewrite to vercel.json

**Files:**
- Modify: `vercel.json`

**Why first:** Deploying the AuthCallback page before the rewrite is live means the email links would 404. Ship the rewrite in the same deploy; ordering the plan this way keeps diffs small and reviewable.

- [ ] **Step 1: Read current vercel.json to confirm shape**

Run: `cat vercel.json` (via Read tool)
Expected: Contains `framework`, `buildCommand`, `outputDirectory`, `crons`, `headers` — no `rewrites` key yet.

- [ ] **Step 2: Add a `rewrites` block above `headers`**

Edit `vercel.json` — insert after the `crons` array, before `headers`:

```json
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
```

Final file should be valid JSON (trailing comma after `]` is required because `headers` follows).

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected output: `ok`

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat(routing): SPA fallback so /auth/callback serves index.html"
```

---

## Task 2: Create AuthCallback component

**Files:**
- Create: `src/components/AuthCallback.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/AuthCallback.tsx` with this exact content:

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Status = 'working' | 'error';

type VerifyType = 'signup' | 'recovery' | 'email_change' | 'email' | 'invite' | 'magiclink';

const VALID_TYPES: VerifyType[] = ['signup', 'recovery', 'email_change', 'email', 'invite', 'magiclink'];

function isValidType(t: string | null): t is VerifyType {
  return !!t && (VALID_TYPES as string[]).includes(t);
}

export function AuthCallback() {
  const [status, setStatus] = useState<Status>('working');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (!token_hash || !isValidType(type)) {
      setErrorMsg('This link is missing or malformed. Request a new email and try again.');
      setStatus('error');
      return;
    }

    // verifyOtp establishes the session (or fires PASSWORD_RECOVERY for recovery links).
    // The AuthProvider listener in src/lib/auth.tsx handles post-verify routing.
    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        setErrorMsg(error.message || 'Verification failed. The link may have expired.');
        setStatus('error');
        return;
      }
      // Clean the URL so a refresh doesn't re-run verifyOtp with a now-consumed token.
      // We don't route manually — the auth listener will swap views on session/recovery event.
      window.history.replaceState(null, '', '/');
    });
  }, []);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text)] p-6">
        <div className="max-w-md w-full border border-[var(--c-border)] bg-[var(--c-surface)] rounded-2xl p-6 text-center">
          <h1 className="text-[18px] font-semibold mb-2">Link didn’t work</h1>
          <p className="text-[14px] text-[var(--c-text-subtle)] mb-5">{errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              window.location.replace('/');
            }}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[var(--c-brand)] text-white text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text-subtle)] text-[14px]">
      Verifying your email…
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors mentioning `AuthCallback.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthCallback.tsx
git commit -m "feat(auth): add AuthCallback page for token-hash email links"
```

---

## Task 3: Wire AuthCallback into App.tsx

**Files:**
- Modify: `src/App.tsx:1-52`

- [ ] **Step 1: Add import**

Edit `src/App.tsx` — add this import alongside the other component imports (next to `LoginPage`):

```tsx
import { AuthCallback } from './components/AuthCallback';
```

- [ ] **Step 2: Short-circuit render on `/auth/callback`**

Edit `src/App.tsx` — insert the path check as the **first** conditional render inside the component, above the existing `if (loading)` block. The useEffects and theme handling above it should stay unchanged.

Replace:

```tsx
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text-subtle)] text-[14px]">
        Loading…
      </div>
    );
  }
```

With:

```tsx
  if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text-subtle)] text-[14px]">
        Loading…
      </div>
    );
  }
```

Note: the `typeof window` guard is defensive against any future SSR; current Vite build runs CSR only, but the check is one line.

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds, `dist/` updated, no type errors.

- [ ] **Step 4: Smoke-test locally**

Run: `npm run dev` (leave running in background)
In a second terminal/browser, visit: `http://localhost:5173/auth/callback?token_hash=fake&type=signup`
Expected: "Verifying your email…" briefly, then the error card ("Link didn't work" with message about expired/invalid). This proves routing + verifyOtp wiring, not a real verify.
Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(auth): route /auth/callback to AuthCallback component"
```

---

## Task 4: Point signUp / resetPassword redirects at /auth/callback

**Files:**
- Modify: `src/lib/auth.tsx:56`
- Modify: `src/lib/auth.tsx:72`

**Why this is a safety net, not the primary fix:** Supabase's `{{ .SiteURL }}` in the email template already controls the link domain. `emailRedirectTo` / `redirectTo` in client options only matter if a template falls back to `{{ .ConfirmationURL }}`. Keeping them aligned avoids a mismatch if a template is ever reverted in the dashboard.

- [ ] **Step 1: Update signUp's emailRedirectTo**

Edit `src/lib/auth.tsx` — in the `signUp` function, replace:

```tsx
        emailRedirectTo: window.location.origin,
```

With:

```tsx
        emailRedirectTo: `${window.location.origin}/auth/callback`,
```

- [ ] **Step 2: Update sendPasswordReset's redirectTo**

Edit `src/lib/auth.tsx` — in the `sendPasswordReset` function, replace:

```tsx
      redirectTo: window.location.origin,
```

With:

```tsx
      redirectTo: `${window.location.origin}/auth/callback`,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.tsx
git commit -m "feat(auth): align client redirect URLs with /auth/callback"
```

---

## Task 5: Update confirm-signup.html template

**Files:**
- Modify: `docs/email-templates/confirm-signup.html:48`
- Modify: `docs/email-templates/confirm-signup.html:57`

- [ ] **Step 1: Swap the button href (line 48)**

Edit `docs/email-templates/confirm-signup.html` — replace:

```html
                      <a href="{{ .ConfirmationURL }}"
```

With:

```html
                      <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup"
```

- [ ] **Step 2: Swap the fallback link (line 57)**

Edit the same file — replace:

```html
                  <a href="{{ .ConfirmationURL }}" style="color:#10b981;word-break:break-all;">{{ .ConfirmationURL }}</a>
```

With:

```html
                  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup" style="color:#10b981;word-break:break-all;">{{ .SiteURL }}/auth/callback?type=signup</a>
```

Note: visible text deliberately omits the raw token for spam-filter cleanliness (long opaque hashes in visible anchor text are a known spam signal).

- [ ] **Step 3: Verify no `{{ .ConfirmationURL }}` remains in this file**

Use Grep: pattern `ConfirmationURL` path `docs/email-templates/confirm-signup.html`.
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/email-templates/confirm-signup.html
git commit -m "feat(email): switch signup template to token-hash flow"
```

---

## Task 6: Update reset-password.html template

**Files:**
- Modify: `docs/email-templates/reset-password.html:44`
- Modify: `docs/email-templates/reset-password.html:53`

- [ ] **Step 1: Swap the button href (line 44)**

Edit `docs/email-templates/reset-password.html` — replace:

```html
                      <a href="{{ .ConfirmationURL }}"
```

With:

```html
                      <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery"
```

- [ ] **Step 2: Swap the fallback link (line 53)**

Edit the same file — replace:

```html
                  <a href="{{ .ConfirmationURL }}" style="color:#10b981;word-break:break-all;">{{ .ConfirmationURL }}</a>
```

With:

```html
                  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery" style="color:#10b981;word-break:break-all;">{{ .SiteURL }}/auth/callback?type=recovery</a>
```

- [ ] **Step 3: Verify no `{{ .ConfirmationURL }}` remains**

Use Grep: pattern `ConfirmationURL` path `docs/email-templates/reset-password.html`.
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/email-templates/reset-password.html
git commit -m "feat(email): switch password-reset template to token-hash flow"
```

---

## Task 7: Update change-email.html template

**Files:**
- Modify: `docs/email-templates/change-email.html:44`
- Modify: `docs/email-templates/change-email.html:53`

- [ ] **Step 1: Swap the button href (line 44)**

Edit `docs/email-templates/change-email.html` — replace:

```html
                      <a href="{{ .ConfirmationURL }}"
```

With:

```html
                      <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change"
```

- [ ] **Step 2: Swap the fallback link (line 53)**

Edit the same file — replace:

```html
                  <a href="{{ .ConfirmationURL }}" style="color:#10b981;word-break:break-all;">{{ .ConfirmationURL }}</a>
```

With:

```html
                  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change" style="color:#10b981;word-break:break-all;">{{ .SiteURL }}/auth/callback?type=email_change</a>
```

- [ ] **Step 3: Verify no `{{ .ConfirmationURL }}` remains**

Use Grep: pattern `ConfirmationURL` path `docs/email-templates/change-email.html`.
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/email-templates/change-email.html
git commit -m "feat(email): switch email-change template to token-hash flow"
```

---

## Task 8: Deploy + verify in production

**Files:** none — deployment only.

**Required manual Supabase-dashboard steps — do these BEFORE the live signup test:**

1. Supabase dashboard → **Authentication → URL Configuration**
   - Site URL: `https://quizmint.me`
   - Redirect URLs allowlist: ensure `https://quizmint.me/auth/callback` is present. Optionally also add `http://localhost:5173/auth/callback` for dev.
2. Supabase dashboard → **Authentication → Email Templates**
   - Open each of *Confirm signup*, *Reset password*, *Change Email Address*
   - Paste the new template HTML from `docs/email-templates/*.html` (they must match the repo files — the repo is the source of truth).
   - Save each template.

- [ ] **Step 1: Push main**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 2: Deploy to Vercel**

Per project deploy policy (`~/.claude/projects/.../memory/project_deploy_policy.md`): manual only.

```bash
vercel --prod
```

Expected: build succeeds, URL returned pointing at quizmint.me.

- [ ] **Step 3: Complete Supabase dashboard steps above**

Open Supabase dashboard, follow the two bulleted items in the box above this task. Do not skip.

- [ ] **Step 4: End-to-end signup test**

Use a **burner Gmail address** (never the account already in the DB):

1. Visit https://quizmint.me → Sign up with burner address + strong password.
2. Check Gmail inbox (and spam folder — first send may still need one warm-up).
3. Confirm the CTA link now reads `https://quizmint.me/auth/callback?token_hash=...&type=signup` on hover (not `*.supabase.co`).
4. Click the link. Expected: "Verifying your email…" appears briefly, URL cleans to `https://quizmint.me/`, dashboard loads signed-in.
5. Refresh the dashboard. Expected: still signed in (session persists).

If the email landed in spam on this first post-switch send, send a second one (reset password from the login page using the same burner) and confirm that one lands in inbox — the spam signal should drop once the domain mismatch is gone.

- [ ] **Step 5: End-to-end password-reset test**

1. On the login page, click "Forgot password?" with the burner address.
2. Click the reset link. Expected: lands on `/auth/callback`, briefly verifies, URL cleans to `/`, `ResetPasswordPage` renders (because `PASSWORD_RECOVERY` auth event fired).
3. Set a new password. Expected: success, routed to dashboard.

- [ ] **Step 6: Clean up test account**

Delete the burner account via dashboard → Settings → Delete account (the app already re-auths for deletion).

- [ ] **Step 7: Update NEXT_SESSION.md**

Edit `NEXT_SESSION.md` — mark P0-1 as done and renumber the remaining P0 items. Replace the P0 block header so P0-2 (OG metadata) becomes the new top priority. Specifically, in the "What to work on next" section, strike through or remove the "Auth email link domain mismatch" block and adjust the numbering of items below it.

- [ ] **Step 8: Commit docs**

```bash
git add NEXT_SESSION.md
git commit -m "docs: mark auth email callback task done, bump OG metadata to P0-1"
git push origin main
```

---

## Self-Review

**Spec coverage:** Plan addresses all items in `NEXT_SESSION.md` §P0-1 — template swap (Tasks 5-7), `/auth/callback` route + verifyOtp (Tasks 2-3), Supabase dashboard updates (Task 8 manual steps), NEXT_SESSION.md handoff update (Task 8 Step 7). Extra: the `vercel.json` rewrite (Task 1) was added to eliminate the "deploy-and-see" risk the user called out in conversation.

**Placeholder scan:** No "TBD", no "handle edge cases" hand-waves. All code blocks are complete. All file paths are absolute from repo root. Expected outputs are concrete.

**Type consistency:** `AuthCallback` component name used consistently across Task 2 (create) and Task 3 (import + render). `VerifyType` union matches Supabase JS v2 `verifyOtp` accepted types. `token_hash` / `type` param names match Supabase's template vars and the client API. Template `type` values (`signup`, `recovery`, `email_change`) match the three `VALID_TYPES` the component accepts.

**Deployment ordering:** Rewrite ships in same deploy as the AuthCallback page (all tasks commit to `main`, single `vercel --prod` in Task 8). No intermediate state where `/auth/callback` 404s.
