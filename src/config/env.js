const optional = (name, fallback = null) => process.env[name] ?? fallback;

const port = Number(optional('PORT', 2504));

export const env = {
  port,
  nodeEnv: optional('NODE_ENV', 'development'),

  // Signs the session cookie (required for Autodesk 3-legged OAuth).
  sessionSecret: optional('SESSION_SECRET'),

  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
    callbackUrl: optional(
      'GOOGLE_CALLBACK_URL',
      `http://localhost:${port}/api/auth/google/callback`,
    ),
  },

  aps: {
    clientId: optional('APS_CLIENT_ID'),
    clientSecret: optional('APS_CLIENT_SECRET'),
    region: optional('APS_REGION', 'US'),
    callbackUrl: optional(
      'APS_CALLBACK_URL',
      `http://localhost:${port}/api/auth/aps/callback`,
    ),
    authSuccessRedirect: optional('APS_AUTH_SUCCESS_REDIRECT', '/hubs'),
  },
};
