const optional = (name, fallback = null) => process.env[name] ?? fallback;

const port = Number(optional('PORT', 2504));

export const env = {
  port,
  nodeEnv: optional('NODE_ENV', 'development'),

  // Signs the session cookie used for Google-authenticated users.
  sessionSecret: optional('SESSION_SECRET'),

  // Google OAuth: user sign-in + access to the user's Revit files on Drive.
  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
    callbackUrl: optional(
      'GOOGLE_CALLBACK_URL',
      `http://localhost:${port}/api/auth/google/callback`,
    ),
  },

  // Autodesk Platform Services: model translation + analysis.
  aps: {
    clientId: optional('APS_CLIENT_ID'),
    clientSecret: optional('APS_CLIENT_SECRET'),
    region: optional('APS_REGION', 'US'),
  },
};
