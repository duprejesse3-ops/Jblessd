// Netlify path-pattern matching, reimplemented.
//
// Patterns come from two places and use the same syntax in both: `config.path`
// on functions and edge functions, and the `from` / `for` / `excludedPath`
// fields in netlify.toml. A single `*` is a greedy wildcard that crosses path
// segments, so `/*` matches everything and `/product/*` matches every product
// URL at any depth.

/** Escapes regex metacharacters, leaving `*` for the caller to substitute. */
function escapeExceptStar(pattern) {
  return pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}

const cache = new Map()

function toRegExp(pattern) {
  let regex = cache.get(pattern)
  if (regex) return regex
  regex = new RegExp(`^${escapeExceptStar(pattern).replace(/\*/g, '.*')}$`)
  cache.set(pattern, regex)
  return regex
}

/** True when `pathname` matches the pattern (or any pattern, if given a list). */
export function matchesPath(pathname, pattern) {
  if (Array.isArray(pattern)) return pattern.some((p) => matchesPath(pathname, p))
  if (!pattern) return false
  return toRegExp(pattern).test(pathname)
}

/**
 * Captures whatever a trailing `*` matched, for the `:splat` placeholder in
 * netlify.toml redirect targets (`/api/*` → `/.netlify/functions/:splat`).
 */
export function splat(pathname, pattern) {
  if (!pattern.endsWith('/*')) return ''
  const prefix = pattern.slice(0, -1)
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ''
}
