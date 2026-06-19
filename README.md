# bimworx-service

A service for managing Revit/CAD file data, loaded in cloud. The Node server discovers the latest file, uploads it to
Autodesk OSS, translates it to SVF2, and streams progress to the browser
through Socket.IO.

There is no admin UI: open `/` and you see the model.

## What's inside

```
Browser ──GET /──▶  viewer page (Autodesk Viewer 7 + socket.io-client)
                   │
                   │ GET /api/model      (also lazy-triggers a sync)
                   ▼
                Express
                   │
        Google Drive  ─list & download─▶  Autodesk OSS  ─translate─▶  Model Derivative
                   │                                                       │
                   │              ◀──────────── extraction.finished ───────┘
                   ▼
              model.store ──change──▶ Socket.IO ──▶ Browser ──▶ Viewer loads URN
```

Architecture deep-dive: [`docs/adsk-services.md`](docs/adsk-services.md).

## Tech stack

* **Node.js 20+**, ES modules.
* **Express 5**, **Socket.IO 4**.
* `@aps_sdk/authentication`, `@aps_sdk/oss`, `@aps_sdk/model-derivative`.
* Google Drive REST v3 via native `fetch` (no `googleapis` dependency).
* `@ngrok/ngrok` (optional) for local webhook callbacks.

## Getting started

1. Create an APS app at <https://aps.autodesk.com/myapps> with at least
   **Data Management API** and **Model Derivative API** enabled.
2. Create a Google API key with the **Drive API** enabled
   (<https://console.cloud.google.com/apis/credentials>).
3. Share a Drive folder as **"Anyone with the link can view"** and drop one or
   more `.rvt` (or `.rfa`, `.nwd`, `.nwc`, `.ifc`) files into it.
4. ```bash
   cp .env.example .env
   # Fill in: APS_CLIENT_ID, APS_CLIENT_SECRET,
   #          GOOGLE_DRIVE_FOLDER_ID, GOOGLE_API_KEY
   npm install
   npm install --include=optional   # only if you need ngrok for local webhooks
   npm run dev
   ```
5. Open <http://localhost:2504>. The page will:
   * Look up the latest file in the folder.
   * Show progress (`download` → `upload` → `translate` → `translating` → `ready`).
   * Auto-load the model in the Autodesk Viewer.

Subsequent opens are instant — the cached translation is reused until the
upstream Drive file changes (`modifiedTime` differs).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/` | Single-page viewer (static). |
| `GET`  | `/api/health` | Liveness probe. |
| `GET`  | `/api/auth/token` | Viewer-scoped 2-legged token (`viewables:read`). |
| `GET`  | `/api/model` | Current model snapshot; lazily triggers a sync. |
| `POST` | `/api/model/sync?force=true` | Force a re-sync (admin / cron). |
| `POST` | `/api/webhooks/translation-complete` | APS-internal callback (HMAC-verified). |

## Realtime

Socket.IO at `/socket.io`. The server emits a single event:

* `model:update` → full `ModelSnapshot` (sent on connect and on every state change).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with `node --watch`. |
| `npm start`   | Production start. |

## License

UNLICENSED — internal project.
