import { env } from '../config/env.js';

// Express recognizes this as an error-handling middleware by its 4-argument signature.
export const errorHandler = (err, _req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.publicMessage ?? 'Internal Server Error';

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    error: message,
    ...(env.nodeEnv !== 'production' && { detail: err.message }),
  });
};
