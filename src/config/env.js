import crypto from 'node:crypto';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const optional = (name, fallback = null) => process.env[name] ?? fallback;

const boolean = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
};

const integer = (name, fallback) => {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  port: Number(optional('PORT', 2504)),
  nodeEnv: optional('NODE_ENV', 'development'),

  aps: {
    get clientId() {
      return required('APS_CLIENT_ID');
    },
    get clientSecret() {
      return required('APS_CLIENT_SECRET');
    },
    region: optional('APS_REGION', 'US'),

    bucketKey: optional(
      'APS_BUCKET_KEY',
      `bimworx-${crypto.createHash('sha1').update(process.env.APS_CLIENT_ID ?? 'unset').digest('hex').slice(0, 12)}`
    ),
    bucketPolicy: optional('APS_BUCKET_POLICY', 'temporary'),
  },

  googleDrive: {
    get folderId() {
      return required('GOOGLE_DRIVE_FOLDER_ID');
    },
    get apiKey() {
      return required('GOOGLE_API_KEY');
    },
    fileExtensions: (optional('GOOGLE_DRIVE_FILE_EXTENSIONS', '.rvt,.rfa,.nwd,.nwc,.ifc') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },

  sync: {
    pollIntervalMs: integer('SYNC_POLL_INTERVAL_MS', 5_000),
    manifestTimeoutMs: integer('SYNC_MANIFEST_TIMEOUT_MS', 10 * 60_000),
  },

  webhooks: {
    publicUrl: optional('APS_WEBHOOK_URL'),
    workflowId: optional('APS_WEBHOOK_WORKFLOW_ID', 'bimworx-default-workflow'),
    sharedSecret: optional('APS_WEBHOOK_SECRET'),
  },

  tunnel: {
    enabled: boolean('APS_TUNNEL_ENABLED', !process.env.APS_WEBHOOK_URL),
    authtoken: optional('NGROK_AUTHTOKEN'),
  },

  realtime: {
    corsOrigin: optional('REALTIME_CORS_ORIGIN', '*'),
  },
};
