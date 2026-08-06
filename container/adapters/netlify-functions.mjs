// Stands in for `@netlify/functions`.
//
// `Context` and `Config` are imported as types throughout the codebase, so they
// vanish during Node's type stripping and need no runtime counterpart. The one
// runtime import is purgeCache, used by products.mts and marketing-agent.mts
// after a write to invalidate a CDN cache tag.
//
// There is no CDN in front of the container by default, so the cache those
// calls target does not exist and there is nothing to purge. Rather than fail,
// this records the request and returns — both call sites already wrap it in
// try/catch and treat a failure as non-fatal, but succeeding quietly keeps
// their logs clean.
//
// If a CDN is put in front of the container, this is the single place to wire
// its purge API in; the application code does not change.

export async function purgeCache(options = {}) {
  const tags = options.tags?.join(', ') || 'all'
  if (process.env.LOG_CACHE_PURGE === 'true') {
    console.log(`purgeCache: no CDN configured, ignoring purge of [${tags}]`)
  }
}

export default { purgeCache }
