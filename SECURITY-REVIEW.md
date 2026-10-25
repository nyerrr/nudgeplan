# Security review

Date: 2026-10-25

## Findings addressed

| Severity | Area | Finding | Remediation |
| --- | --- | --- | --- |
| Medium | Transport | The frontend used HTTP URLs by default, which could expose private brain dumps and check-ins on an untrusted network. | Non-loopback frontend URLs now require HTTPS. Local HTTP remains available for development. |
| Medium | Supply chain | Backend requirements were unpinned. | Direct backend dependencies are pinned to tested versions in `backend/requirements.txt`. |
| High | API exposure | A non-loopback backend could be reached without authentication. | `run.py` refuses non-loopback startup without `API_AUTH_TOKEN`; the API validates `X-API-Key` when configured. |
| Medium | CORS | CORS allowed every origin, method, and header. | CORS now uses an explicit `CORS_ORIGINS` allowlist and restricted methods/headers. |
| Medium | Resource abuse | Brain-dump input had no upper bound. | `PlanRequest.text` is limited to 12,000 characters. |
| Low | Response hardening | Responses lacked baseline browser security headers. | Added `nosniff`, clickjacking protection, referrer protection, and no-store caching headers. |

## Deployment requirements

1. Keep `HOST=127.0.0.1` for local-only use.
2. For LAN or public deployments, set a long random `API_AUTH_TOKEN`.
3. Terminate TLS at a reverse proxy and configure the frontend with an HTTPS
   `EXPO_PUBLIC_API_URL`.
4. Set `CORS_ORIGINS` to exact trusted origins only.
5. Keep `.env` files and API keys out of source control.
6. Review pinned dependencies before upgrading them and run the backend checks.

## Residual limitations

The API-key mechanism is intended for a single trusted app installation, not
multi-user identity management. A public deployment should additionally use a
proper identity provider, rate limiting, centralized logging, and secret
rotation.
