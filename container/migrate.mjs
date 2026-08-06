// Applies the SQL migrations in netlify/database/migrations to the container's
// Postgres.
//
// On Netlify the platform applies these; a self-hosted Postgres starts empty
// and needs them run once at first boot. The files are the same ones the
// platform uses — this reads them from the repository rather than keeping a
// second copy, so the container schema cannot drift from the deployed schema.
//
// Two directory layouts exist and both are handled: most migrations are flat
// `<name>.sql` files, while the first one is a `<name>/migration.sql`
// directory. Ordering is lexicographic on the name, which is why the timestamp
// prefixes exist.
//
//   node --import ./container/hooks/register.mjs container/migrate.mjs
//   node --import ./container/hooks/register.mjs container/migrate.mjs --check

import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(process.env.APP_ROOT || join(HERE, '..'))
const MIGRATIONS_DIR = join(APP_ROOT, 'netlify/database/migrations')

// Deliberately not named `schema_migrations`: if this is ever pointed at the
// existing Netlify/Neon database, it must not collide with or corrupt whatever
// bookkeeping the platform keeps there.
const LEDGER = 'container_schema_migrations'

async function collectMigrations() {
  const entries = (await readdir(MIGRATIONS_DIR)).sort()
  const migrations = []

  for (const entry of entries) {
    const full = join(MIGRATIONS_DIR, entry)
    const info = await stat(full)

    if (info.isDirectory()) {
      const inner = join(full, 'migration.sql')
      try {
        migrations.push({ name: entry, sql: await readFile(inner, 'utf8') })
      } catch {
        console.warn(`skipping ${entry}: no migration.sql inside`)
      }
      continue
    }

    if (!entry.endsWith('.sql')) continue
    migrations.push({ name: entry.replace(/\.sql$/, ''), sql: await readFile(full, 'utf8') })
  }

  return migrations
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const migrations = await collectMigrations()
  const pool = new pg.Pool({ connectionString, max: 1 })

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${LEDGER} (
         name        text PRIMARY KEY,
         applied_at  timestamptz NOT NULL DEFAULT now()
       )`,
    )

    const { rows } = await pool.query(`SELECT name FROM ${LEDGER}`)
    const applied = new Set(rows.map((r) => r.name))
    const pending = migrations.filter((m) => !applied.has(m.name))

    if (!pending.length) {
      console.log(`schema up to date (${migrations.length} migrations)`)
      return
    }

    if (checkOnly) {
      console.log(`${pending.length} pending migration(s):`)
      for (const m of pending) console.log(`  ${m.name}`)
      process.exitCode = 1
      return
    }

    for (const migration of pending) {
      const client = await pool.connect()
      try {
        // One transaction per migration: a failure rolls that file back
        // completely rather than leaving the schema half-changed, and the
        // ledger row is written in the same transaction so it can never claim
        // a migration was applied when it was not.
        await client.query('BEGIN')
        await client.query(migration.sql)
        await client.query(`INSERT INTO ${LEDGER} (name) VALUES ($1)`, [migration.name])
        await client.query('COMMIT')
        console.log(`applied ${migration.name}`)
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        console.error(`failed ${migration.name}: ${error.message}`)
        throw error
      } finally {
        client.release()
      }
    }

    console.log(`applied ${pending.length} migration(s)`)
  } finally {
    await pool.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
