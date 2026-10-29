# Security review

Date: 2026-10-29

## Findings addressed

| Severity | Area | Finding | Remediation |
| --- | --- | --- | --- |
| High | API exposure | A non-loopback backend could be reached without authentication, and the newer `/plan/*` routes were outside the auth prefix. | `/ai/*` and `/plan/*` now require a Supabase user token whenever Supabase is configured. `run.py` refuses remote startup without Supabase auth or a strong static token. |
| High | Database access | The public Supabase anon key was the only guard on user tables. | `supabase_setup.sql` enables Row Level Security and owner-only policies for profiles, tasks, steps, history, daily stats, and check-ins. |
| High | Static key | A bundled `EXPO_PUBLIC_API_KEY`/`X-API-Key` could bypass per-user auth and could be extracted from the app. | The app no longer reads or sends a static key. When Supabase is configured, the backend ignores `API_AUTH_TOKEN` entirely. |
| Medium | Transport | The frontend used HTTP URLs by default, which could expose private brain dumps and check-ins on an untrusted network. | Non-loopback API and Supabase URLs now require HTTPS. Local HTTP remains available for development. |
| Medium | Resource abuse | AI routes could be called in a loop with no request throttle. | Per-user/IP in-process rate limiting (`AI_RATE_LIMIT`, default 30/min), a 64 KiB request-body cap, and Pydantic input limits. |
| Medium | CORS | CORS allowed every origin, method, and header. | CORS now uses an explicit `CORS_ORIGINS` allowlist, rejects `*`, and only advertises the headers the app needs. |
| Medium | Response hardening | Responses lacked baseline browser security headers. | Added `nosniff`, frame denial, referrer/permissions policies, strict API CSP, HSTS over HTTPS, and `no-store` caching headers. |
| Low | Docs exposure | Swagger exposed the full API surface in production. | Docs are disabled automatically when Supabase auth is enabled unless `ENABLE_DOCS=true`. |
| Low | Auth transport | A redirected Supabase verification request could carry the bearer token elsewhere. | Supabase verification disables redirects, uses a short timeout, and caps token length. |
| Low | Supply chain | Backend requirements were unpinned; frontend dependencies had audit findings. | Direct backend dependencies are pinned in `backend/requirements.txt`; `npm audit fix` was applied. Remaining audit findings are in Expo CLI build tooling and need an Expo upgrade. |

## Deployment requirements

1. Keep `HOST=127.0.0.1` for local-only use.
2. For LAN or public deployments, configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   and `AUTH_REQUIRED=true`, then terminate TLS at a reverse proxy.
3. Run `supabase_setup.sql` in the Supabase SQL editor and verify RLS is enabled
   on every user table.
4. Set `CORS_ORIGINS` to exact trusted origins only.
5. Keep `.env` files, `GEMINI_API_KEY`, and `API_AUTH_TOKEN` out of source
   control and out of `EXPO_PUBLIC_*` variables.
6. Rotate any token that was ever committed or shared in a build.
7. Review pinned dependencies before upgrading them and run the backend and
   frontend checks.

## Residual limitations

The AI rate limiter is process-local, so a multi-instance deployment should
move it to Redis or the hosting platform's edge. Supabase sessions are stored in
AsyncStorage/localStorage; on web, a successful XSS could read them, so keep the
frontend free of untrusted HTML injection. Centralized logging and secret
rotation still need to be configured at the deployment layer.
