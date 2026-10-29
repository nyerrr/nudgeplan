# Deploying NudgePlan

Four pieces: the **backend** (Render), the **Android APK / iPhone build**
(EAS Build), and the **Supabase redirect allow-list**. Do them in this order.

---

## 1. Backend on Render

The repo ships `backend/render.yaml`, so Render can create the service from it.

1. Push this branch to GitHub.
2. In Render: **New â†’ Blueprint**, pick the `nudgeplan` repo.
3. Render reads `backend/render.yaml` and asks for the `sync: false` values:
   - `GEMINI_API_KEY` â€” from https://aistudio.google.com/apikey
   - `SUPABASE_URL` â€” `https://<project-ref>.supabase.co`
   - `SUPABASE_ANON_KEY` â€” Supabase â†’ Project Settings â†’ API â†’ anon/public
4. Create the service and wait for the first deploy.
5. Verify:

   ```powershell
   curl https://nudgeplan-api.onrender.com/health
   ```

   Expect `{"status":"healthy", ...}`.

`AUTH_REQUIRED=true` is already in the blueprint. With `SUPABASE_URL` set, every
`/ai/*` and `/plan/*` call needs a signed-in user's token; guests fall back to
the offline planner. `/` and `/health` stay public. Docs are hidden
automatically when Supabase auth is enabled.

Run [`supabase_setup.sql`](supabase_setup.sql) in the Supabase SQL editor after
creating the tables. It enables Row Level Security, adds owner-only policies,
and adds the `tasks.due_date` column used for Upcoming deadlines.

> Free instances sleep after ~15 minutes idle. The app waits 60 s for a reply,
> so the first request after a long pause may still time out and fall back to
> offline planning. Upgrade to a paid instance if that matters.

**If your Render URL is not `nudgeplan-api.onrender.com`**, update
`EXPO_PUBLIC_API_URL` in `frontend/eas.json` (both `preview` and `production`).

---

## 2. Supabase redirect URLs

Supabase â†’ **Authentication â†’ URL Configuration**.

**Site URL** â€” the address the browser should return to. This is the *web* app,
never the app scheme:

```
http://localhost:8081        # while developing
https://<your-web-domain>    # the deployed web build
```

**Additional Redirect URLs** â€” everything the app may ask for, including the
native deep link:

```
http://localhost:8081
http://localhost:8081/**
https://<your-web-domain>
https://<your-web-domain>/**
nudgeplan://auth/callback
nudgeplan://**
```

`nudgeplan://auth/callback` is what the APK passes as `redirectTo`; the
`http(s)` entries are what the web build passes (`window.location.origin`).
Any origin missing from this list is replaced by the **Site URL**, so a web
sign-in then ends up at the custom scheme and Chrome shows:

```
Failed to launch 'nudgeplan:?code=â€¦' because the scheme does not have a registered handler.
```

That message is almost always a Site URL / allow-list problem, not an app bug.

Google Cloud needs no change: the Web OAuth client still redirects to
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
When it finishes you get a QR code and a download link â€” share that link.

Installing on a phone: open the link on Android, allow **Install unknown apps**
for the browser when prompted.

The first build also generates and stores the Android **keystore** on EAS. Keep
access to the Expo account: losing it means you cannot ship updates to the same
app ID.

### Releasing a fix

1. Bump `expo.android.versionCode` in `frontend/app.json` (2, 3, 4â€¦).
2. `eas build -p android --profile preview` again.
3. Share the new link. Android installs it over the old version.

`versionCode` must increase every time. The `cli.appVersionSource` setting in
`eas.json` is `local`, so `app.json` is the source of truth.

---

## 4. Build for iOS

iOS has **no free equivalent of the APK link**. You cannot hand someone a file
or a QR and have it install on an iPhone unless you have an **Apple Developer
Program** membership ($99/yr) â€” that is Apple's rule, not the app's.

The project is ready for it: `ios.bundleIdentifier` and `ios.buildNumber` are in
`app.json`, and the `preview-ios` profile in `eas.json` produces an installable
`.ipa` for registered devices.

### Ad-hoc install (link or QR, no App Store)

1. Enrol in the Apple Developer Program.
2. Register each iPhone (max 100 per year, each needs a rebuild if added later):
   ```powershell
   eas device:create
   ```
   Open the link it prints on the phone; it collects the UDID automatically.
3. Build:
   ```powershell
   eas build -p ios --profile preview-ios
   ```
4. Share the build's install link or QR from expo.dev. The phone must open it in
   **Safari** (not Chrome) â€” it installs over the air and lands on the home screen.

### TestFlight (better for lots of testers)

```powershell
eas submit -p ios
```

Then add testers in App Store Connect. No UDIDs, builds last 90 days, external
testers get a short beta review. Internal testers skip review entirely.

### Notes

- Google sign-in returns to `nudgeplan://auth/callback` on iOS too â€” already in
  the allow-list from step 2.
- Bump `expo.ios.buildNumber` in `app.json` before every rebuild, the same way
  `versionCode` works for Android.
- `expo start` â†’ QR opens **Expo Go**, which is a preview client, not an install
  of NudgePlan. It also cannot complete Google sign-in (`exp://` redirect).
- No Apple account? Ship the **web build** instead: it runs in Safari, can be
  added to the home screen, and costs nothing.

---

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Render only | Never in the app or git. |
| `SUPABASE_URL` | Render + `frontend/.env` | Public. |
| `SUPABASE_ANON_KEY` | Render + `frontend/eas.json` | Public by design; RLS is the real guard. |
| `EXPO_PUBLIC_API_URL` | `frontend/eas.json` | Must be HTTPS in builds. |
| `API_AUTH_TOKEN` | local backend only | Static fallback for self-hosting without Supabase. Ignored when Supabase is configured; never put it in the app. |
| `AI_RATE_LIMIT` | Render (optional) | Requests per user/IP per window. Defaults to 30/minute. |
| `ENABLE_DOCS` | Render (optional) | Leave unset; docs are hidden in production. |

---

## Testing against the deployed backend locally

```powershell
cd frontend
$env:EXPO_PUBLIC_API_URL = "https://nudgeplan-api.onrender.com"
npx expo start --web --port 8081 -c
```

Remember to start Metro with `-c` after changing any `EXPO_PUBLIC_*` value â€”
Expo inlines them at bundle time.

---

## Not done yet

- **Offline conflict handling** â€” signed-in plans sync to Supabase, but the
  app still keeps a local copy and does not yet do field-level conflict
  resolution between two devices editing at the same time.
- **OTA updates** â€” `expo-updates` is not configured, so every JS change needs a
  new build. It must be added *before* a build to take effect.
- **Play Store** â€” the `production` profile already emits an AAB, but publishing
  needs a $25 account, a privacy policy, and a closed test.
