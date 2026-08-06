// Stands in for `@netlify/database`.
//
// Netlify's package is a thin wrapper over Neon Postgres; underneath it is
// `pg`. The application only ever touches two things on the object returned by
// getDatabase(): the `sql` tagged template (65 call sites) and `pool` (3 call
// sites in netlify/lib/credits.mts, which take a client out of the pool to run
// an explicit BEGIN/COMMIT transaction). Both are reproduced exactly, so the
// same query code runs unchanged against any Postgres.
//
// Interpolated values become $1, $2, … bind parameters — never string
// concatenation — which is the same guarantee the Netlify wrapper makes and the
// reason the existing query code is safe against injection.

import pg from 'pg'

let pool = null

function connectionString() {
  const url =
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED
  if (!url) {
    throw new Error(
      'No database configured. Set DATABASE_URL to a Postgres connection string.',
    )
  }
  return url
}

/**
 * Lazily built so importing this module never opens a socket. Several code
 * paths import a lib that imports the database but then never issue a query
 * (the catalog fallback, for instance), and those must not fail or hold a
 * connection when no database is reachable.
 */
function getPool() {
  if (pool) return pool

  pool = new pg.Pool({
    connectionString: connectionString(),
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 10_000),
  })

  // A pooled client can be dropped by the server (restart, idle reaper) while
  // it sits unused. Without a listener that surfaces as an unhandled 'error'
  // event and takes the whole process down, so this logs and lets pg discard
  // the dead client and make a new one on the next checkout.
  pool.on('error', (err) => {
    console.error('postgres pool: idle client error —', err.message)
  })

  return pool
}

/** Tagged template → parameterised query. Returns the rows, as Netlify's does. */
async function sql(strings, ...values) {
  let text = ''
  for (let i = 0; i < strings.length; i += 1) {
    text += strings[i]
    if (i < values.length) text += `$${i + 1}`
  }
  const result = await getPool().query(text, values)
  return result.rows
}

export function getDatabase() {
  return {
    sql,
    // Getter rather than a property so that merely calling getDatabase()
    // does not construct the pool.
    get pool() {
      return getPool()
    },
  }
}

/** Lets the server shut the pool down cleanly on SIGTERM. */
export async function closeDatabase() {
  if (!pool) return
  const closing = pool
  pool = null
  await closing.end().catch(() => {})
}

export default { getDatabase, closeDatabase }
