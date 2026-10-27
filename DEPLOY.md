# Deploying NudgePlan

Three pieces: the **backend** (Render), the **APK** (EAS Build), and the
**Supabase redirect allow-list**. Do them in this order.

---

## 1. Backend on Render

The repo ships `backend/render.yaml`, so Render can create the service from it.

1. Push this branch to GitHub.
2. In Render: **New → Blueprint**, pick the `nudgeplan` repo.
3. Render reads `backend/render.yaml` and asks for the `sync: false` values:
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
   - `SUPABASE_URL` — `https://<project-ref>.supabase.co`
   - `SUPABASE_ANON_KEY` — Supabase → Project Settings → API → anon/public
4. Create the service and wait for the first deploy.
5. Verify:

   ```powershell
   curl https://nudgeplan-api.onrender.com/health
   ```

   Expect `{"status":"healthy", ...}`.

`AUTH_REQUIRED=true` is already in the blueprint. With `SUPABASE_URL` set, every
`/ai/*` call needs a signed-in user's token; guests fall back to the offline
planner. `/` and `/health` stay public.

> Free instances sleep after ~15 minutes idle. The app waits 20 s for a reply,
> so the first request after a long pause may still time out and fall back to
> offline planning. Upgrade to a paid instance if that matters.

**If your Render URL is not `nudgeplan-api.onrender.com`**, update
`EXPO_PUBLIC_API_URL` in `frontend/eas.json` (both `preview` and `production`).

---

## 2. Supabase redirect URLs

Supabase → **Authentication → URL Configuration → Additional Redirect URLs**,
add both:

```
nudgeplan://auth/callback
nudgeplan://**
```

Keep `http://localhost:8081` for web development. Google Cloud needs no change:
the Web OAuth client still redirects to
`https://<project-ref>.supabase.co/auth/v1/callback`.

---

## 3. Build the APK

One-time setup:

```powershell
npm install -g eas-cli
cd frontend
eas login
eas init
```

`eas init` links the project and writes `extra.eas.projectId` into `app.json`.
Then build:

```powershell
eas build -p android --profile preview
```

The preview profile produces an **APK** (not an AAB) and uploads it to Expo.
When it finishes you get a QR code and a download link — share that link.

Installing on a phone: open the link on Android, allow **Install unknown apps**
for the browser when prompted.

The first build also generates and stores the Android **keystore** on EAS. Keep
access to the Expo account: losing it means you cannot ship updates to the same
app ID.

### Releasing a fix

1. Bump `expo.android.versionCode` in `frontend/app.json` (2, 3, 4…).
2. `eas build -p android --profile preview` again.
3. Share the new link. Android installs it over the old version.

`versionCode` must increase every time. The `cli.appVersionSource` setting in
`eas.json` is `local`, so `app.json` is the source of truth.

---

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Render only | Never in the app or git. |
| `SUPABASE_URL` | Render + `frontend/.env` | Public. |
| `SUPABASE_ANON_KEY` | Render + `frontend/eas.json` | Public by design; RLS is the real guard. |
| `EXPO_PUBLIC_API_URL` | `frontend/eas.json` | Must be HTTPS in builds. |
| `EXPO_PUBLIC_API_KEY` | now unused in builds | Dev-only `X-API-Key` backdoor; ships in the bundle, so never a secret. |
| `API_AUTH_TOKEN` | local backend only | Optional alternative to Supabase auth for local testing. |

---

## Testing against the deployed backend locally

```powershell
cd frontend
$env:EXPO_PUBLIC_API_URL = "https://nudgeplan-api.onrender.com"
npx expo start --web --port 8081 -c
```

Remember to start Metro with `-c` after changing any `EXPO_PUBLIC_*` value —
Expo inlines them at bundle time.

---

## Not done yet

- **Cross-device sync** — plans live in AsyncStorage on the device. Reinstalling
  the APK clears them. A Supabase `plans` table with RLS is the next step.
- **OTA updates** — `expo-updates` is not configured, so every JS change needs a
  new build. It must be added *before* a build to take effect.
- **Play Store** — the `production` profile already emits an AAB, but publishing
  needs a $25 account, a privacy policy, and a closed test.
