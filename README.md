# bimworx-service

A cloud service for viewing and analyzing Revit/CAD models. Users sign in
with Google, the service reads their Revit files from Google Drive, uploads
them to Autodesk Platform Services (APS), translates them to SVF2, and streams
progress and analysis results to the browser over Socket.IO.

The frontend is a server-rendered shell (EJS) that today boots a small
vanilla-JS client and is being migrated to a React app.

> **Status:** early scaffolding. Only the server shell, the home page, and
> `GET /api/health` are implemented today. Everything under
> [Roadmap](#roadmap) is planned and not wired up yet.

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
   #          APS_CLIENT_ID, APS_CLIENT_SECRET
   npm install
   npm run dev
   ```
4. Open <http://localhost:2504>.

## Endpoints

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET`  | `/` | Server-rendered viewer shell (EJS). | ✅ implemented |
| `GET`  | `/api/health` | Liveness probe. | ✅ implemented |
| `GET`  | `/api/auth/google` | Start Google OAuth sign-in. | 🚧 planned |
| `GET`  | `/api/auth/google/callback` | OAuth callback → session. | 🚧 planned |
| `GET`  | `/api/auth/token` | Viewer-scoped APS token (`viewables:read`). | ✅ implemented |
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
