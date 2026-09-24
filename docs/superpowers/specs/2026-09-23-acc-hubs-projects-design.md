# ACC hubs & projects (3-legged APS) — design

**Date:** 2026-09-23  
**Status:** approved (conversation); pending user review of this file  
**Branch context:** `core/base-structure`  
**Related:** existing 2-legged `GET /api/auth/token` (viewer); Google Drive OAuth remains separate / out of scope

## Goal

Let an Autodesk-authenticated user list ACC (and compatible) hubs and the projects they can access, via Data Management API.

## Decisions

| Decision | Choice |
|---|---|
| Auth model | Autodesk **3-legged** OAuth (Authorization Code) |
| Scope of this slice | Login + hubs + projects API (no UI, no Docs browsing) |
| SDK | `@aps_sdk/authentication` + `@aps_sdk/data-management` |
| Session | `express-session` storing APS tokens server-side |
| Viewer token | Keep existing 2-legged `viewables:read` endpoint unchanged |

## Architecture

```
Browser
  │  GET /api/auth/aps/login
  ▼
Express ──redirect──▶ Autodesk authorize
  │  GET /api/auth/aps/callback?code=…
  ▼
Exchange code → session { access_token, refresh_token, expires_at }
  │
  ├─ GET /api/hubs                    ──▶ Data Management getHubs
  └─ GET /api/hubs/:hubId/projects    ──▶ Data Management getHubProjects
```

3-legged token is used **only** for Data Management (and future ACC APIs).  
2-legged `viewables:read` remains for Autodesk Viewer only — never return 3-legged write/data tokens to the browser.

## Endpoints

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/api/auth/aps/login` | none | 302 → Autodesk authorize URL |
| `GET` | `/api/auth/aps/callback` | none (code) | Set session; 302 → `/` (or configured success URL) |
| `GET` | `/api/auth/aps/logout` | session | Destroy session; 204 or 302 |
| `GET` | `/api/auth/me` | session | `{ authenticated, user? }` (optional but useful) |
| `GET` | `/api/hubs` | `requireApsAuth` | `[{ id, name, region }]` |
| `GET` | `/api/hubs/:hubId/projects` | `requireApsAuth` | `[{ id, name }]` |

### Error behaviour

- Missing session on protected routes → `401` with `{ error: '...' }` (API clients; no HTML redirect for `/api/*`).
- Expired access token → middleware attempts refresh once; failure → clear session + `401`.
- APS upstream failures → sanitized `502` (no Authorization headers / secrets in logs), same pattern as `apsAuth.js`.
- Missing APS credentials in env → `503` with clear public message.

## OAuth details

- **Grant:** Authorization Code (private client: client id + secret).
- **Scopes (minimum):** `data:read`. Optionally add `openid` and `user-profile:read` if `/api/auth/me` should return profile.
- **Callback URL:** `APS_CALLBACK_URL` (default `http://localhost:2504/api/auth/aps/callback`). Must match APS app settings.
- **State:** generate random `state`, store in session, validate on callback (CSRF).
- **Refresh:** use `AuthenticationClient.refreshToken` when `expires_at` is near (e.g. &lt; 60s remaining).

## Config (env)

Extend `src/config/env.js` and `.env.example`:

- Existing: `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_REGION`, `SESSION_SECRET`, `PORT`
- Add / wire: `APS_CALLBACK_URL`
- Optional: `APS_AUTH_SUCCESS_REDIRECT` (default `/`)

Portal prerequisites (documented in README, not code):

1. APS app has **Data Management API** enabled.
2. Callback URL registered.
3. App provisioned as **Custom Integration** on the ACC account (otherwise hubs may be empty).

## Module layout

```
src/
  config/env.js                    # + aps.callbackUrl
  middlewares/
    requireApsAuth.js              # session + refresh
  services/
    apsAuth.js                     # existing 2-legged viewer token (unchanged contract)
    apsOAuth.js                    # authorize URL, exchange code, refresh
    apsData.js                     # getHubs, getHubProjects
  controllers/
    apsAuth.controller.js          # login, callback, logout, me
    hubs.controller.js             # list hubs / projects
  routes/
    auth.routes.js                 # mount aps login/callback/logout/me + existing /token
    hubs.routes.js                 # /hubs, /hubs/:hubId/projects
  app/createApp.js                 # express-session cookie middleware
```

### Response mapping

Hubs: map SDK items to `{ id, name, region: attributes.region ?? null }`.  
Projects: map to `{ id, name }` (ACC hub/project ids keep the `b.` prefix as returned by APS).

## Dependencies to add

- `express-session`
- `@aps_sdk/data-management`

No Passport. No UI changes in this slice.

## Out of scope

- Project picker UI / React
- Listing Docs folders/files
- Uploading / translating models from ACC
- Google OAuth / Drive
- Design Automation / clash detection
- 2-legged + Custom Integration + `x-user-id` path

## Acceptance criteria

1. Unauthenticated `GET /api/hubs` → `401`.
2. After completing Autodesk login in browser, `GET /api/hubs` → `200` and JSON array (possibly empty if account not provisioned).
3. `GET /api/hubs/:hubId/projects` → `200` with projects the user can access.
4. `GET /api/auth/token` still returns viewer-scoped 2-legged token only.
5. Logs never contain `Authorization` headers or client secrets on APS errors.
6. README documents callback URL, scopes, and ACC Custom Integration requirement.

## Risks / notes

- Empty hubs list is often a **provisioning** issue, not a code bug.
- Session cookie must be `httpOnly`; in production set `secure: true` when `NODE_ENV === 'production'`.
- Google OAuth (earlier roadmap) is a separate identity path; do not reuse APS session for Google Drive.
