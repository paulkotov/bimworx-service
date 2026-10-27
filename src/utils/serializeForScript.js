/**
 * Safely serialize a value for embedding inside an inline <script> tag.
 * Escapes characters that could break out of the script context or act as
 * line/paragraph separators in JS strings, preventing XSS via injected state
 * (e.g. a Drive file name or Google profile field).
 */
export const serializeForScript = (value) =>
  JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
