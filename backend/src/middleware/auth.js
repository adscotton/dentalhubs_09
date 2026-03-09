function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;

  const [scheme, token] = header.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;

  const normalizedToken = token.trim();
  return normalizedToken || null;
}

function requireAccessToken(req, res, next) {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    return res.status(401).json({
      error: 'Missing bearer token. Add Authorization: Bearer <access_token>.',
    });
  }

  req.accessToken = accessToken;
  return next();
}

module.exports = {
  getBearerToken,
  requireAccessToken,
};
