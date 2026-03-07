/**
 * OpenSearch has been removed. This middleware is kept as a no-op stub
 * so existing code that references req.opensearch won't crash at runtime.
 * All queries now fall back to the database.
 */
export function opensearchMiddleware() {
  return async (req, res, next) => {
    req.opensearch = null
    next()
  }
}
