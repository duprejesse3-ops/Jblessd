// Stands in for `@netlify/blobs`.
//
// Four call sites use blob storage: rate-limit buckets, cached AI deliverables,
// order-email dedup markers, and cached product demos. All of them use the same
// small slice of the API — get / set / setJSON on a named store — so that is
// what is reproduced here, backed by the filesystem.
//
// Point BLOBS_DIR at a mounted volume (the compose file does) or the data is
// lost when the container is replaced. Losing it is survivable rather than
// fatal: rate-limit buckets and demo caches simply start cold, and the
// order-email dedup marker degrades to "an order confirmation could be sent
// twice if the container is replaced mid-checkout".
//
// For more than one replica this needs to become S3 or Redis — a filesystem
// store is per-container, so two replicas would keep separate rate-limit
// counters and separate dedup markers. Single container, single volume is the
// supported topology; the README says so.

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

const ROOT = process.env.BLOBS_DIR || '/data/blobs'

/**
 * Keys arrive from untrusted input — a client IP for rate limiting, a Stripe
 * session id, a cache key built from a product SKU. Hashing rather than
 * sanitising means no key can escape its store directory no matter what it
 * contains, and no key can collide with another after sanitisation stripped the
 * characters that made it unique. The original key is kept alongside the value
 * so a human reading the directory can still tell what a file is.
 */
function pathFor(storeName, key) {
  const safeStore = createHash('sha256').update(String(storeName)).digest('hex').slice(0, 16)
  const safeKey = createHash('sha256').update(String(key)).digest('hex')
  return join(ROOT, safeStore, `${safeKey}.json`)
}

async function writeAtomic(file, contents) {
  await mkdir(dirname(file), { recursive: true })
  // Same-directory temp file, then rename: a reader either sees the old value
  // or the new one, never a half-written file.
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, contents, 'utf8')
  await rename(tmp, file)
}

function createStore(storeName) {
  return {
    /**
     * Returns null for a missing key, matching Netlify's behaviour — the
     * calling code relies on that to distinguish "no cached value" from a
     * stored empty string.
     */
    async get(key, options = {}) {
      let raw
      try {
        raw = await readFile(pathFor(storeName, key), 'utf8')
      } catch (err) {
        if (err.code === 'ENOENT') return null
        throw err
      }

      const envelope = JSON.parse(raw)
      if (options.type === 'json') {
        return typeof envelope.value === 'string' ? JSON.parse(envelope.value) : envelope.value
      }
      return typeof envelope.value === 'string' ? envelope.value : JSON.stringify(envelope.value)
    },

    async set(key, value) {
      const body = typeof value === 'string' ? value : String(value)
      await writeAtomic(pathFor(storeName, key), JSON.stringify({ key, value: body }))
    },

    async setJSON(key, value) {
      await writeAtomic(
        pathFor(storeName, key),
        JSON.stringify({ key, value: JSON.stringify(value) }),
      )
    },

    async delete(key) {
      try {
        await unlink(pathFor(storeName, key))
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
    },
  }
}

/** Accepts both call styles used in the codebase: a name, or an options object. */
export function getStore(nameOrOptions) {
  const name =
    typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions?.name
  if (!name) throw new Error('getStore requires a store name')
  // `consistency` is accepted and ignored: a single filesystem is already
  // strongly consistent, which is what the two callers asking for it wanted.
  return createStore(name)
}

export default { getStore }
