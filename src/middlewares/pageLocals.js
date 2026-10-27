/**
 * Locals shared by all server-rendered pages (header, auth links).
 */
export const pageLocals = (req, res, next) => {
  res.locals.authenticated = Boolean(req.session?.aps?.accessToken);
  // Starts Autodesk OAuth; the /login page is the public landing shell.
  res.locals.loginUrl = '/api/auth/aps/login';
  res.locals.logoutUrl = '/api/auth/aps/logout';
  next();
};
