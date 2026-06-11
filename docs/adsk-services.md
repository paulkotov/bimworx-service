# adsk-services architecture

`bimworx-service` is a single-page Autodesk Viewer for the **latest** CAD/BIM file
that lives in a public Google Drive folder. It synchronizes that file into
Autodesk OSS, translates it to SVF2 via Model Derivative, and streams progress
to the viewer page over Socket.IO.

There is **no user-facing UI** beyond the viewer itself. The server owns the
end-to-end pipeline: discover → download → upload → translate → display.

---

## High-level flow

```
                  ┌─────────────────────────────────────────────────────────┐
   Browser ──GET /──▶│  Express  │──static──▶ index.html + app.js + socket.io │
                  └─────────────────────────────────────────────────────────┘
       │
       │ 1. GET /api/model           (lazy: also kicks off sync if idle)
       ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                          sync.ensureLatestModel()                     │
   │                                                                       │
   │  Google Drive API key ──► pick latest file (orderBy modifiedTime)     │
   │             │                                                          │
   │             ▼                                                          │
   │     downloadFileBuffer(fileId)                                         │
   │             │                                                          │
   │             ▼                                                          │
   │   OssClient.uploadObject(bucket, "{fileId}_{sha}.rvt", buffer)        │
   │             │                                                          │
   │             ▼                                                          │
   │   ModelDerivativeClient.startJob(urn, misc={workflow})                 │
   │             │                                                          │
   │             ├── webhook (preferred) ──► /api/webhooks/translation-     │
   │             │                                              complete   │
   │             │                                                          │
   │             └── manifest polling (fallback) ─────────────────────────  │
   └──────────────────────────────────────────────────────────────────────┘
       │
       │ 2. model.store events ──► Socket.IO ──► browser
       ▼
   Viewer auto-loads the URN once status == 'ready'.
```

The model state lives in a single in-memory state machine
(`src/store/model.store.js`):

```
   idle ──▶ syncing (list → download → upload → translate)
              │
              ▼
          translating ──▶ ready
              │              ▲
              ▼              │
            failed ──────────┘  (re-sync on next request)
```

A second request for `/api/model` while a sync is in flight returns the
in-progress snapshot — `ensureLatestModel` de-duplicates concurrent calls.

---

## Module layout

| Path | Responsibility |
|---|---|
| `src/config/env.js` | Strongly-typed env access with defaults. |
| `src/services/autodesk.service.js` | Two-legged token cache (per scope-set). |
| `src/services/oss.service.js` | `ensureBucket`, `uploadObject`, `createSignedUrl`, URN helpers (base64url). |
| `src/services/derivatives.service.js` | `startTranslation` (SVF2 + `misc.workflow`), `getManifest`. |
| `src/services/webhooks.service.js` | `reconcileExtractionWebhook` — idempotent webhook setup; dedups stale hooks. |
| `src/services/googleDrive.service.js` | `pickLatestFile`, `downloadFileBuffer` via Drive REST + API key. |
| `src/services/sync.service.js` | Orchestrates Drive → OSS → translation; in-flight de-dup; manifest poll fallback. |
| `src/store/model.store.js` | Singleton `EventEmitter` state machine for the tracked model. |
| `src/realtime/socket.js` | Socket.IO server, broadcasts `model:update`. |
| `src/infra/tunnel.js` | Optional `@ngrok/ngrok` tunnel for local webhook callbacks. |
| `src/controllers/auth.controller.js` | `GET /api/auth/token` (viewer scopes only). |
| `src/controllers/model.controller.js` | `GET /api/model`, `POST /api/model/sync`. |
| `src/controllers/webhooks.controller.js` | `extraction.finished` callback with HMAC-SHA1 verification. |
| `src/controllers/health.controller.js` | `GET /api/health`. |
| `src/routes/{health,auth,model,webhooks}.routes.js` | Express routers. |
| `src/index.js` | Bootstraps HTTP → Socket.IO → bucket → tunnel → webhook reconcile. |

---

## HTTP API

### `GET /`
The viewer page (`src/public/index.html`). It loads `app.js` which:

1. Initializes the Autodesk Viewer with the token from `/api/auth/token`.
2. Calls `GET /api/model` (which lazily kicks off a sync if needed).
3. Subscribes to `model:update` Socket.IO events.
4. Loads the URN automatically when `status === 'ready'`.

### `GET /api/health`
Liveness probe.

### `GET /api/auth/token`
Viewer-scoped 2-legged token (`viewables:read`). Server-side credentials never leave the backend.

```json
{ "access_token": "...", "expires_in": 3599 }
```

### `GET /api/model[?sync=false]`
Returns the current `ModelSnapshot`. When the snapshot is `idle` or `failed`
**and** no sync is in flight, it kicks off a fresh sync (fire-and-forget).
Pass `?sync=false` to inspect state without triggering work.

```ts
type ModelStatus = 'idle' | 'syncing' | 'translating' | 'ready' | 'failed';
type SyncStep    = 'list' | 'download' | 'upload' | 'translate';

interface ModelSnapshot {
  status:             ModelStatus;
  step:               SyncStep | null;     // only meaningful while status === 'syncing'
  urn:                string | null;       // URL-safe base64 URN of the OSS object
  objectName:         string | null;       // object key inside the bucket
  sourceFileId:       string | null;
  sourceFileName:     string | null;
  sourceModifiedTime: string | null;       // ISO timestamp from Drive
  sourceSize:         number | null;
  progress:           string | null;       // translation progress, e.g. "42%"
  error:              string | null;
  updatedAt:          number;              // epoch ms
}
```

### `POST /api/model/sync[?force=true]`
Explicitly trigger a sync. Useful for a cron job or admin "refresh" button.
Returns `202` with the current snapshot. The sync runs in the background and
state changes are observable via `GET /api/model` or Socket.IO.

### `POST /api/webhooks/translation-complete`
APS-internal endpoint. Called by the `extraction.finished` webhook when our
workflow id finishes a translation. Verifies `x-adsk-signature` (HMAC-SHA1)
when `APS_WEBHOOK_SECRET` is configured.

---

## Realtime API (Socket.IO)

Connect with `io()` from a page that loads `/socket.io/socket.io.js`.

| Direction | Event | Payload |
|---|---|---|
| server → client (on connect) | `model:update` | full `ModelSnapshot` |
| server → client (on any change) | `model:update` | full `ModelSnapshot` |

No subscribe/unsubscribe semantics — only one model is tracked.

---

## Boot order (`src/index.js`)

```
http.createServer(app)
   │
   ├─ httpServer.listen(env.port)
   │
   └─ bootstrap():
       ├─ initSocket(httpServer)              // realtime ready before any work
       ├─ ensureBucket()                      // create-if-missing, 404-tolerant
       └─ startTunnel(env.port)               // resolves APS_WEBHOOK_URL > ngrok > null
            └─ reconcileExtractionWebhook(publicUrl + '/api/webhooks/translation-complete')
                 └─ deletes stale hooks scoped to our workflow id
```

If neither `APS_WEBHOOK_URL` nor ngrok is available, the server still works:
`sync.service.js` falls back to **polling** `getManifest(urn)` every
`SYNC_POLL_INTERVAL_MS` until either it returns `success` or
`SYNC_MANIFEST_TIMEOUT_MS` elapses.

---

## Google Drive access

The folder must be **shared as "Anyone with the link can view"** so that the
Google API key can list and download its contents without OAuth.

To get the folder id:
1. Open the folder in Drive.
2. Copy the last path segment from the URL `drive.google.com/drive/folders/<this>`.

To create the API key:
1. <https://console.cloud.google.com/apis/credentials>
2. *Create credentials → API key*.
3. Enable the **Google Drive API** for the same project.
4. (Recommended) Restrict the key to *Drive API* only.

Set `GOOGLE_DRIVE_FOLDER_ID` and `GOOGLE_API_KEY` in `.env`. The service lists
files in the folder with `orderBy=modifiedTime desc`, filters by
`GOOGLE_DRIVE_FILE_EXTENSIONS` (defaults to `.rvt,.rfa,.nwd,.nwc,.ifc`) and picks
the first one.

---

## Environment variables

See [`.env.example`](../.env.example) for the canonical list.

| Variable | Required? | Notes |
|---|---|---|
| `APS_CLIENT_ID` / `APS_CLIENT_SECRET` | yes | From the APS developer portal. |
| `APS_REGION` | no | `US` (default), `EMEA`, etc. |
| `APS_BUCKET_KEY` | no | Auto-derived from a SHA-1 of your client id if omitted. |
| `APS_BUCKET_POLICY` | no | `transient` (24h), `temporary` (30d, default), `persistent`. |
| `GOOGLE_DRIVE_FOLDER_ID` | yes | Public folder shared with "Anyone with the link". |
| `GOOGLE_API_KEY` | yes | API key with the Drive API enabled. |
| `GOOGLE_DRIVE_FILE_EXTENSIONS` | no | Comma-separated whitelist. |
| `SYNC_POLL_INTERVAL_MS` | no | Default `5000`. |
| `SYNC_MANIFEST_TIMEOUT_MS` | no | Default `600000` (10 min). |
| `APS_WEBHOOK_URL` | recommended in prod | Public base URL, no trailing slash. |
| `APS_WEBHOOK_WORKFLOW_ID` | no | `[A-Z0-9-]{1,36}`. Scopes & dedups webhooks. |
| `APS_WEBHOOK_SECRET` | recommended | Verifies `x-adsk-signature`. |
| `APS_TUNNEL_ENABLED` | no | Defaults to `true` when `APS_WEBHOOK_URL` is empty. |
| `NGROK_AUTHTOKEN` | dev only | Or run `ngrok config add-authtoken …`. |
| `REALTIME_CORS_ORIGIN` | no | Lock down in production. |

---

## Operational notes

* **Object naming.** OSS objects are named `${driveFileId}_${sha1(fileId+modifiedTime).slice(0,12)}.${ext}`. Each Drive revision gets a fresh URN, so the translation cache is naturally versioned.
* **Idempotency.** `ensureLatestModel()` short-circuits when the in-store snapshot already matches the latest Drive file's `(id, modifiedTime)`.
* **Concurrency.** A single `inflight` promise dedups all callers; opening the page in five tabs won't fan out into five downloads.
* **Webhook hygiene.** `reconcileExtractionWebhook` is called on every boot. It keeps **one** hook scoped to `APS_WEBHOOK_WORKFLOW_ID` pointing at the current public URL and deletes any stale ones (e.g. from previous ngrok sessions).
* **Security.** `APS_WEBHOOK_SECRET` enables HMAC-SHA1 verification of webhook bodies. Keep it set in production.

---

## Troubleshooting

* **`401 invalid_client` from APS** — re-check `APS_CLIENT_ID` / `APS_CLIENT_SECRET` and that the app has the required APS APIs enabled.
* **`403 from drive.googleapis.com`** — folder isn't public, or the API key isn't enabled for Drive, or hits the per-IP referrer restriction.
* **`No file found in the configured Google Drive folder.`** — folder is empty, or all files have extensions outside `GOOGLE_DRIVE_FILE_EXTENSIONS`.
* **Stuck at "Translating"** — webhook can't reach the server. Either set `APS_WEBHOOK_URL`, enable ngrok, or accept the polling fallback (up to `SYNC_MANIFEST_TIMEOUT_MS`).
* **Viewer shows "No default geometry"** — the source file translated but produced no default viewable. Check the manifest payload via `GET https://developer.api.autodesk.com/modelderivative/v2/designdata/{urn}/manifest`.

---

## Future work

* Persistence layer (e.g. SQLite or Redis) so `model.store` survives restart and we don't re-translate on every cold boot.
* Multi-tenant support: keyed model store, viewer page selects which model to load.
* Google Drive push notifications (`changes.watch`) to trigger an instant re-sync.
* Configurable output format (currently SVF2).
* Manifest cleanup of superseded versions when the Drive file is updated.
