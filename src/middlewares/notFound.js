export const notFound = (req, res) => {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.originalUrl}` });
};
