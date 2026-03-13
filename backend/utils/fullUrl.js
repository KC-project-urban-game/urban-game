// ──────────────────────────────────────────────────────────────
// fullUrl – turns a relative path like "/uploads/abc.png"
// into a fully-qualified URL using the backend's public origin.
//
// Priority:
//   1. BACKEND_URL env var  (e.g. "https://api.example.com")
//   2. Derived from the incoming request (protocol + host)
// ──────────────────────────────────────────────────────────────

function getOrigin(req) {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

/**
 * Turn a relative path (e.g. "/uploads/img.png") into a full URL.
 * Returns null/undefined unchanged.
 */
function fullUrl(req, relativePath) {
  if (!relativePath) return relativePath;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;
  return `${getOrigin(req)}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

module.exports = fullUrl;
