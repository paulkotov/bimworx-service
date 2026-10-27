/**
 * Error helpers shared across services and controllers.
 *
 * Every error that should reach the client carries two extra fields consumed by
 * the central error handler (see middlewares/errorHandler.js):
 *   - `status`        HTTP status code
 *   - `publicMessage` safe, user-facing message (never leaks internals)
 *
 * IMPORTANT: we intentionally do NOT attach the original `cause` object. Upstream
 * SDK/axios errors can carry request headers with credentials; keeping them off
 * the Error prevents them from leaking into logs.
 */

/**
 * Creates an HTTP-aware error.
 * @param {number} status HTTP status code
 * @param {string} publicMessage safe, user-facing message
 * @param {string} [internalMessage] optional technical message for logs
 */
export const createHttpError = (status, publicMessage, internalMessage) => {
  const err = new Error(internalMessage ?? publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  return err;
};

/**
 * Wraps a failed Autodesk Platform Services (APS) call as a sanitized 502 error.
 * @param {unknown} cause the original (unsafe) error
 * @param {string} publicMessage safe, user-facing message
 */
export const sanitizeApsError = (cause, publicMessage) =>
  createHttpError(502, publicMessage, cause?.message);
