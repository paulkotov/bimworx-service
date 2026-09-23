# Autodesk & Google services — architecture notes

> Status: design notes for the planned pipeline. The server scaffolding exists
> (`src/`), but the integrations below are not implemented yet. See the
> [README roadmap](../README.md#roadmap).

## Overview

bimworx-service turns a user's Revit file (stored on their Google Drive) into
an interactive, analyzable 3D model in the browser. Three external systems are
involved:

1. **Google OAuth + Drive** — authenticates the user and reads their files.
2. **Autodesk Platform Services (APS)** — stores, translates, and exposes the
   model for analysis and viewing.
3. **Autodesk Viewer (client-side)** — renders the translated SVF2 model.

## 1. Google authentication & Drive access

* **Auth model:** per-user OAuth 2.0 (Authorization Code flow). The user signs
  in with Google; we store tokens in the server session.
* **Scopes (planned):**
  * `openid`, `email`, `profile` — identify the user.
  * `https://www.googleapis.com/auth/drive.readonly` — read the user's Revit
    files.
* **Config:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
  (see `.env.example`).
* **Library:** `@googleapis/drive`.

## 2. Autodesk Platform Services pipeline

The classic APS translation flow:

1. **Authentication** (`@aps_sdk/authentication`) — 2-legged token.
   * `data:read data:write data:create bucket:create bucket:read` for the
     pipeline; `viewables:read` for the client-side viewer token.
2. **OSS** (`@aps_sdk/oss`) — ensure a bucket exists, upload the `.rvt`,
   obtain an `objectId` (URN).
3. **Model Derivative** (`@aps_sdk/model-derivative`) — request an SVF2
   translation, poll (or receive a webhook) until `complete`, then extract
   metadata/properties for analysis.

```
Drive file ──download──▶ OSS object ──translate──▶ SVF2 derivatives
                                                        │
                                              metadata / properties
                                                        │
                                                  analysis results
```

* **Config:** `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_REGION`.

## 3. Client-side viewer

* Autodesk Viewer 7 (loaded from the APS CDN in `views/index.ejs`).
* Fetches a `viewables:read` token from `/api/auth/token` (planned) and loads
  the translated URN.

## Realtime progress

State transitions (`download → upload → translate → translating → ready`) are
pushed to the browser via Socket.IO (`model:update`). This lets the EJS/React
shell show live progress without polling.
