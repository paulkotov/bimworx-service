const optional = (name, fallback = null) => process.env[name] ?? fallback;

export const env = {
  port: Number(optional('PORT', 2504)),
  nodeEnv: optional('NODE_ENV', 'development'),
};
