# bimworx-service

A cloud service for viewing and analyzing Revit/CAD models. Users sign in
with Google, the service reads their Revit files from Google Drive, uploads
them to Autodesk Platform Services (APS), translates them to SVF2, and streams
progress and analysis results to the browser over Socket.IO.

The frontend is a server-rendered shell (EJS) that today boots a small
vanilla-JS client and is being migrated to a React app.

> **Status:** early scaffolding. The server shell, home page, `GET /api/health`,
> APS 3-legged login, and hubs/projects listing are implemented today.
> Google OAuth and model sync remain planned — see [Roadmap](#roadmap).

## Architecture

```
Browser ──GET /──▶  EJS shell (Autodesk Viewer 7 + socket.io-client)
                   │
                   │ Google sign-in ──▶ session
                   ▼
                Express
                   │
   Google Drive (user's files) ─download─▶ APS OSS ─translate─▶ Model Derivative
                   │                                                    │
                   │              ◀──────────── analysis finished ──────┘
                   ▼
              model state ──change──▶ Socket.IO ──▶ Browser ──▶ Viewer loads URN
```

Architecture deep-dive: [`docs/adsk-services.md`](docs/adsk-services.md).

## Tech stack

* **Node.js 20+**, ES modules.
* **Express 5** with **EJS** views (React app to be mounted into the shell).
* **Socket.IO 4** for realtime progress/analysis updates.
* **Google OAuth** (sign-in + Drive access) via `@googleapis/drive`.
* `@aps_sdk/authentication`, `@aps_sdk/oss`, `@aps_sdk/model-derivative`.

## Getting started

1. Create an APS app at <https://aps.autodesk.com/myapps> with the
   **Data Management API** and **Model Derivative API** enabled.
2. Create a Google OAuth client (**"Web application"**) at
   <https://console.cloud.google.com/apis/credentials> and enable the
   **Drive API**. Add `http://localhost:2504/api/auth/google/callback` as an
   authorized redirect URI.
3. Configure and run:
   ```bash
   cp .env.example .env
   # Fill in: SESSION_SECRET,
   #          GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
   #          APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL
   npm install
   npm run dev
   ```
4. Open <http://localhost:2504>.

### Autodesk Construction Cloud (ACC)

To list hubs and projects via the Data Management API:

1. On your APS app at <https://aps.autodesk.com/myapps>, register the callback
   `http://localhost:2504/api/auth/aps/callback` and enable the **Data
   Management API** (Model Derivative is still required for translation).
   Autodesk 3-legged login requests OAuth scopes `data:read`, `openid`, and
   `user-profile:read` (must be allowed for the APS app / user consent).
2. In ACC **Account Admin**, provision the same APS app as a **Custom
   Integration** on the account that owns the hubs you expect to see.
3. Set `SESSION_SECRET`, `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, and
   `APS_CALLBACK_URL` in `.env` (see `.env.example`).
4. Sign in with APS: open <http://localhost:2504/api/auth/aps/login>, complete
   Autodesk login, then call `GET /api/hubs` (browser or API client with the
   session cookie).

If `/api/hubs` returns an empty list after a successful login, the usual cause
is a missing **Custom Integration** on the ACC account—not an application bug.

## Endpoints

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET`  | `/` | Server-rendered viewer shell (EJS). | ✅ implemented |
| `GET`  | `/api/health` | Liveness probe. | ✅ implemented |
| `GET`  | `/api/auth/google` | Start Google OAuth sign-in. | 🚧 planned |
| `GET`  | `/api/auth/google/callback` | OAuth callback → session. | 🚧 planned |
| `GET`  | `/api/auth/token` | Viewer-scoped APS token (2-legged, `viewables:read`). | ✅ implemented |
| `GET`  | `/api/auth/aps/login` | Start APS 3-legged OAuth (ACC / BIM 360). | ✅ implemented |
| `GET`  | `/api/auth/aps/callback` | APS OAuth callback → session. | ✅ implemented |
| `GET`  | `/api/auth/aps/logout` | Clear APS session. | ✅ implemented |
| `GET`  | `/api/auth/me` | Current session / APS auth status. | ✅ implemented |
| `GET`  | `/api/hubs` | List ACC hubs for the signed-in user. | ✅ implemented |
| `GET`  | `/api/hubs/:hubId/projects` | List projects in a hub. | ✅ implemented |
| `GET`  | `/api/model` | Current model snapshot; lazily triggers a sync. | 🚧 planned |
| `POST` | `/api/model/sync` | Force a re-sync / re-analysis. | 🚧 planned |

## Realtime

Socket.IO is served at `/socket.io`. The server accepts connections today; the
`model:update` event (full model snapshot) will be emitted once the analysis
pipeline lands.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with `node --watch`. |
| `npm start`   | Production start. |

## Roadmap

* Google OAuth sign-in + session middleware.
* Per-user Google Drive file discovery/download.
* APS pipeline: OSS upload → Model Derivative translation (SVF2) → analysis.
* `model:update` realtime snapshots over Socket.IO.
* React app mounted into the EJS shell.

## License

UNLICENSED — internal project.
