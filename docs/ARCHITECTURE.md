# BimWorx Service — Architecture

A cloud service that authenticates users with **Autodesk Platform Services (APS)**,
lets them browse **ACC / BIM 360** hubs, projects, folders and documents, and
download/upload files. Pages are **server-rendered with EJS**; a small amount of
progressive-enhancement JavaScript runs in the browser.

- Runtime: **Node.js ≥ 20**, ES modules (`"type": "module"`)
- Web framework: **Express 5**
- Views: **EJS**
- Realtime: **socket.io** (viewer status updates)
- APS SDKs: `@aps_sdk/authentication`, `@aps_sdk/data-management`, `@aps_sdk/oss`

---

## 1. Layered (3-tier) architecture

The codebase follows a strict **Routes → Controllers → Services** layering, with
cross-cutting concerns (auth, errors, config) factored out.

```
HTTP request
   │
   ▼
┌─────────────┐   defines endpoints, attaches middleware, maps to a controller
│   routes/   │   (thin; no business logic)
└─────┬───────┘
      ▼
┌─────────────┐   parse req params/body, call services, shape the response
│ controllers/│   (thin; no APS SDK calls, no data mapping)
└─────┬───────┘
      ▼
┌─────────────┐   business logic, APS SDK access, aggregation, DTO mapping
│  services/  │   (the only layer that talks to Autodesk)
└─────┬───────┘
      ▼
   APS APIs (Authentication, Data Management, OSS)
```

**Golden rule:** the APS SDK is imported **only** inside `services/`. Controllers
never see raw APS responses — services return normalized DTOs (see
`apsMappers.js`).

### Directory map

```
src/
├─ index.js                 # process entry: starts HTTP + socket.io
├─ app/
│  ├─ createApp.js          # builds the Express app (session, middleware order)
│  └─ registerRoutes.js     # mounts /api and page routers + static assets
├─ routes/                  # LAYER 1 — endpoint wiring
│  ├─ index.js              #   /api aggregate router
│  ├─ page.routes.js        #   server-rendered pages
│  ├─ hubs.routes.js        #   /api/hubs/**
│  ├─ auth.routes.js        #   /api/auth/**
│  └─ health.routes.js
├─ controllers/             # LAYER 2 — req/res handling
│  ├─ page.controller.js    #   renders EJS views
│  ├─ hubs.controller.js    #   JSON + download/upload endpoints
│  ├─ auth.controller.js    #   viewer token
│  ├─ apsAuth.controller.js #   3-legged OAuth login/callback/logout
│  └─ health.controller.js
├─ services/                # LAYER 3 — business logic + APS integration
│  ├─ apsClients.js         #   shared DataManagement/OSS client singletons
│  ├─ apsData.js            #   READS: hubs, projects, folders + view aggregation
│  ├─ apsFiles.js           #   FILES: download (signed URL) + upload (storage→item)
│  ├─ apsMappers.js         #   DTO mapping (anti-corruption layer)
│  ├─ apsAuth.js            #   2-legged viewer token (viewables:read)
│  ├─ apsOAuth.js           #   3-legged OAuth (authorize/exchange/refresh)
│  └─ apsSession.js         #   ensureApsAccessToken (session token + refresh)
├─ middlewares/             # cross-cutting
│  ├─ requireApsAuth.js     #   API guard   → 401 JSON
│  ├─ requireApsPage.js     #   page guard  → redirect to /login
│  ├─ pageLocals.js         #   shared view locals (auth links)
│  ├─ errorHandler.js       #   central error → JSON
│  └─ notFound.js
├─ config/
│  └─ env.js                # all environment configuration in one place
├─ utils/
│  ├─ httpError.js          # createHttpError / sanitizeApsError
│  ├─ serializeForScript.js # safe JSON embedding into HTML
│  └─ paths.js
├─ views/                   # EJS templates + partials
└─ public/                  # static CSS + browser JS
```

---

## 2. Request flows

### 2.1 Page render (e.g. `GET /hubs`)

```
Router (page.routes.js)
  → requireApsPage        # ensures token, sets req.apsAccessToken, else redirect /login
  → renderHubs            # controller: thin
      → getHubsWithProjects(token)   # service: fetch hubs, resolve projects, map DTOs
  → res.render('hubs', viewModel)    # EJS
```

The controller does not call the APS SDK and does not do fan-out logic — the
service `getHubsWithProjects` owns hub→projects aggregation (including per-hub
error isolation).

### 2.2 JSON API (e.g. `GET /api/hubs/:hubId/projects/:projectId`)

```
Router (hubs.routes.js)
  → requireApsAuth        # 401 JSON if unauthenticated; sets req.apsAccessToken
  → getProject            # controller
      → getProjectOverview(hubId, projectId, token)   # service
  → res.json(overview)
```

> Note: the read-only JSON endpoints (`getHubs`, `getHubProjects`, `getProject`,
> `getFolder`) currently duplicate what the server-rendered pages fetch. They are
> a reusable public API surface, not consumed by the app's own UI today.

### 2.3 File download (`GET .../items/:itemId/download`)

```
requireApsAuth
  → downloadItem
      → getItemDownloadInfo(projectId, itemId, token)   # apsFiles.js
          1. getItemTip → tip version → OSS storage URN
          2. signedS3Download(bucket, object, { responseContentDisposition })
      → res.redirect(signedUrl)   # short-lived S3 URL; filename forced via Content-Disposition
```

### 2.4 File upload (`POST .../folders/:folderId/upload?name=<file>`)

The browser sends **raw bytes** (`express.raw`) with the filename in the query —
no multipart dependency.

```
requireApsAuth → express.raw({ limit: 500mb }) → uploadToFolder
  → validate (name present, non-empty body)          # controller responsibility
  → uploadFileToFolder(projectId, folderId, name, buffer, token)   # apsFiles.js
      1. createStorage        → OSS storage object targeted at the folder
      2. ossClient.uploadObject → upload bytes
      3. createVersion (if a same-named item exists) OR createItem (new file)
```

### 2.5 Authentication

Two distinct token flows:

| Flow | Service | Scopes | Used for |
|------|---------|--------|----------|
| **3-legged** (user) | `apsOAuth.js` + `apsSession.js` | `data:read data:write data:create openid user-profile:read` | hubs/projects/folders, download, **upload** |
| **2-legged** (app) | `apsAuth.js` | `viewables:read` only | the browser Autodesk Viewer token (`/api/auth/token`) |

Login: `startApsLogin` builds the authorize URL with a CSRF `state` (persisted to
session) → Autodesk → `handleApsCallback` verifies `state`, exchanges the code,
stores tokens in the session. `ensureApsAccessToken` transparently refreshes the
access token (60s skew) on every guarded request.

> The 2-legged viewer token is deliberately minimal (`viewables:read`) so a
> write-capable token is never handed to the browser.

---

## 3. Cross-cutting concerns

### Error handling

All errors carry two fields consumed by `middlewares/errorHandler.js`:

- `status` — HTTP status
- `publicMessage` — safe, user-facing text

Two helpers in `utils/httpError.js` create them consistently:

- `createHttpError(status, publicMessage, internalMessage?)` — validation / not-found / config errors.
- `sanitizeApsError(cause, publicMessage)` — wraps a failed APS call as `502`, keeping **only** the message. The original SDK/axios error (which can contain `Authorization` headers with credentials) is intentionally **not** attached, so it never reaches the logger.

Controllers use the uniform `try/catch → next(err)` pattern; the central handler
renders `{ error, [detail in dev] }`.

### Authentication guards

Same session logic (`apsSession.ensureApsAccessToken`), two entry points with
different UX:

- `requireApsAuth` (API) → **401 JSON**
- `requireApsPage` (pages) → **redirect to `/login`**

Both attach `req.apsAccessToken` on success, so controllers uniformly read the
token from the request.

### Configuration

All env access is centralized in `config/env.js`. `APS_REGION` is currently
**reserved** — the installed SDK derives region from hub/bucket IDs and exposes
no per-call region argument.

### View model & presentation

Controllers pass normalized DTOs plus a computed `title`. Templates use a shared
partial `views/partials/contentEntry.ejs` to render a file/folder row (folders
are links, files get a Download button). Client behavior:

- `public/app.js` — Autodesk Viewer bootstrap + socket.io status.
- `public/folder.js` — folder upload (fetch → progress → reload).

---

## 4. Design principles & conventions

1. **APS SDK isolation** — only `services/` imports APS SDKs.
2. **Thin controllers** — parse input, call one service, shape output. No fan-out logic, no SDK, no mapping.
3. **Aggregation in services** — multi-call orchestration lives in `getHubsWithProjects`, `getProjectOverview`, `getFolderView`.
4. **DTO mapping isolated** — `apsMappers.js` shields the app from APS wire-format changes.
5. **Single source of truth for auth** — `apsSession.ensureApsAccessToken`, consumed by both guards.
6. **Uniform errors** — `{ status, publicMessage }` via `utils/httpError.js`; credentials never logged.
7. **Shared SDK clients** — `apsClients.js` singletons (clients are stateless; token is per-call).

---

## 5. Extending the system

- **New read endpoint:** add a mapper (if a new shape) in `apsMappers.js` → a
  read function in `apsData.js` → a controller → a route.
- **New file operation:** add to `apsFiles.js` (reuse `parseStorageUrn` and the
  payload builders) → controller → route.
- **New page:** add a controller in `page.controller.js`, guard the route with
  `requireApsPage`, add an EJS view (reuse `partials/contentEntry.ejs`).
- **Testing seams:** services are pure functions of `(args, accessToken)` around
  the SDK clients; mappers and payload builders are pure and unit-testable.

---

## 6. Known gaps / follow-ups

- **Unused read JSON API** (`getHubs`, `getHubProjects`, `getProject`, `getFolder`)
  — either adopt for client-side rendering or remove.
- **`/api/model`** is fetched by `public/app.js` but has no route yet — the viewer
  falls back to its "sync not available" state.
- **Large-file uploads** are buffered in memory (`express.raw`, 500 MB cap) and
  large **chunked** downloads aren't merged (single signed URL only).
- **`APS_REGION`** is reserved/unwired (see §3).
