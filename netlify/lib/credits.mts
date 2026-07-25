// Prepaid credits — the store's second revenue line.
//
// One-off product sales are transactional: a customer buys once and leaves. The
// Claude Agent Studio at /agent sells *capacity* instead — a balance of credits
// the customer spends running a real Claude agent on their own work, and tops up
// when it runs out. This module is the single source of truth for that economy:
// what a pack costs, what a run costs, and how a balance is allowed to move.
//
// Design rules, all of them deliberate:
//
//   * Money and credits move together or not at all. Every balance change goes
//     through a transaction that also appends a credit_ledger row, so the ledger
//     can always be replayed to explain a balance.
//   * Purchases are idempotent on the Stripe session id. Stripe retries webhooks
//     and the buyer's browser also claims its own session on return from
//     Checkout, so the same purchase is routinely reported twice; the unique
//     index on credit_ledger.stripe_session_id makes the second report a no-op.
//   * A run is charged BEFORE the model is called and refunded if it produced
//     nothing. Charging afterwards would let a caller spend credits it doesn't
//     have by disconnecting mid-stream.
//   * Access keys are bearer tokens, stored only as SHA-256 hashes. The
//     plaintext is shown to the customer once (and emailed); the database keeps
//     nothing that can be replayed if it leaks.
//   * Prices live here, never in the browser. The client is told what a pack
//     costs so it can render the page, but the amount charged and the credits
//     granted are always read back from this file server-side.

import { getDatabase } from '@netlify/database'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// ---- catalog of credit packs -------------------------------------------------
//
// Larger packs carry a bonus rather than a lower headline price: the customer
// sees exactly what a credit costs and gets rewarded for committing, which is
// what turns a one-time top-up into a standing balance.

export interface CreditPack {
  id: string
  label: string
  credits: number
  bonus: number // extra credits included on top of `credits`
  priceCents: number
  blurb: string
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'starter',
    label: 'Starter',
    credits: 100,
    bonus: 0,
    priceCents: 900,
    blurb: 'Try the agent on a few real jobs — about 33 standard runs.',
  },
  {
    id: 'studio',
    label: 'Studio',
    credits: 500,
    bonus: 50,
    priceCents: 3900,
    blurb: 'The working balance: a few runs a day, every day, with 50 credits on the house.',
  },
  {
    id: 'scale',
    label: 'Scale',
    credits: 2000,
    bonus: 400,
    priceCents: 12900,
    blurb: 'For teams running the agent daily — 400 bonus credits, the lowest cost per run.',
  },
]

export function findPack(id: unknown): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === String(id ?? ''))
}

/** Total credits a pack grants, bonus included. */
export function packTotal(pack: CreditPack): number {
  return pack.credits + pack.bonus
}

// ---- agent run modes --------------------------------------------------------
//
// Three tiers, each a real model and a flat, published credit price. Flat pricing
// is a product decision: a customer deciding whether to press "run" should know
// the cost before they press it, not after the tokens land. The actual token
// usage is still recorded per run (agent_runs) so the owner can see the margin.

export interface AgentMode {
  id: string
  label: string
  model: string
  credits: number
  maxTokens: number
  maxSteps: number
  blurb: string
}

export const AGENT_MODES: AgentMode[] = [
  {
    id: 'quick',
    label: 'Quick',
    model: 'claude-haiku-4-5',
    credits: 1,
    maxTokens: 1500,
    maxSteps: 3,
    blurb: 'Fast answers, short drafts, quick lookups.',
  },
  {
    id: 'standard',
    label: 'Standard',
    model: 'claude-sonnet-5',
    credits: 3,
    maxTokens: 4000,
    maxSteps: 5,
    blurb: 'The default working brain — full deliverables, multi-step research.',
  },
  {
    id: 'deep',
    label: 'Deep',
    model: 'claude-opus-5',
    credits: 9,
    maxTokens: 8000,
    maxSteps: 7,
    blurb: 'Hardest problems: strategy, analysis, long documents you will actually send.',
  },
]

export function findMode(id: unknown): AgentMode | undefined {
  return AGENT_MODES.find((m) => m.id === String(id ?? ''))
}

/** The tier a visitor with no balance is allowed to sample, once. */
export const TRIAL_MODE_ID = 'quick'

// ---- access keys ------------------------------------------------------------

const KEY_PREFIX = 'mnai_'

/** Mint a fresh access key. 192 bits of randomness — not guessable, not derived
 * from anything about the customer. */
export function newAccessKey(): string {
  return KEY_PREFIX + randomBytes(24).toString('base64url')
}

/** The only form of a key that is ever persisted. */
export function hashKey(key: string): string {
  return createHash('sha256').update(key.trim()).digest('hex')
}

/** Constant-time comparison of two hex hashes of equal length. */
function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

/** Pull the access key off a request: `Authorization: Bearer …` or `x-agent-key`. */
export function readAccessKey(req: Request): string {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)
  if (bearer) return bearer[1].trim()
  return (req.headers.get('x-agent-key') ?? '').trim()
}

export function looksLikeKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX) && key.length >= KEY_PREFIX.length + 20 && key.length < 200
}

// ---- accounts ---------------------------------------------------------------

export interface CreditAccount {
  id: number
  email: string
  balance: number
  lifetimeCredits: number
  createdAt: string | null
}

function rowToAccount(row: any): CreditAccount {
  return {
    id: Number(row.id),
    email: String(row.email),
    balance: Number(row.balance),
    lifetimeCredits: Number(row.lifetime_credits ?? 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase().slice(0, 320)
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)
}

/** Show enough of an address to recognise it, not enough to harvest it. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return '•••'
  const head = user.slice(0, 2)
  return `${head}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`
}

/**
 * Resolve the account a bearer key belongs to. Returns null for an unknown or
 * malformed key — callers must treat that as "no balance", never as an error
 * worth explaining in detail, so the endpoint can't be used to probe for keys.
 */
export async function accountForKey(key: string): Promise<CreditAccount | null> {
  if (!looksLikeKey(key)) return null
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, email, key_hash, balance, lifetime_credits, created_at
    FROM credit_accounts WHERE key_hash = ${hashKey(key)} LIMIT 1
  `) as any[]
  const row = rows[0]
  if (!row) return null
  // The lookup was already by hash; re-comparing in constant time keeps the
  // code honest if the query is ever widened.
  if (!hashesMatch(String(row.key_hash), hashKey(key))) return null
  return rowToAccount(row)
}

/** Best-effort "this key was used just now" stamp, for the owner's reporting. */
export async function touchAccount(accountId: number): Promise<void> {
  try {
    const db = getDatabase()
    await db.sql`UPDATE credit_accounts SET last_seen_at = now() WHERE id = ${accountId}`
  } catch (err) {
    console.error('credits: could not stamp last_seen_at —', (err as Error).message)
  }
}

export async function accountForEmail(email: string): Promise<CreditAccount | null> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, email, key_hash, balance, lifetime_credits, created_at
    FROM credit_accounts WHERE lower(email) = ${normalizeEmail(email)} LIMIT 1
  `) as any[]
  return rows[0] ? rowToAccount(rows[0]) : null
}

/**
 * Issue a new access key for an account and retire the previous one.
 *
 * Re-issuing is the only recovery path, because the plaintext key is never
 * stored: proving control of the account's email (or of the paid Stripe session
 * that created it) earns a fresh key, and the old key stops working the moment
 * this returns. That trade — one key at a time, always recoverable — is the
 * reason no password or account system is needed here at all.
 */
export async function reissueKey(accountId: number): Promise<string> {
  const key = newAccessKey()
  const db = getDatabase()
  await db.sql`
    UPDATE credit_accounts SET key_hash = ${hashKey(key)}, updated_at = now()
    WHERE id = ${accountId}
  `
  return key
}

// ---- granting purchased credits --------------------------------------------

export interface GrantResult {
  /** False when this Stripe session had already been granted (a retry). */
  granted: boolean
  account: CreditAccount
  balance: number
  credits: number
  /** Set only when a key was minted or re-issued as part of this grant. */
  issuedKey?: string
  isNewAccount: boolean
}

export interface GrantOptions {
  email: string
  credits: number
  amountCents: number
  detail: string
  /** Stripe Checkout session id — the idempotency key for the whole grant. */
  sessionId: string
  /**
   * A key the caller already holds. When it matches the account, the account
   * keeps it (so a repeat top-up from the same browser doesn't invalidate the
   * key the customer has saved).
   */
  presentedKey?: string
  /**
   * Re-issue a key when the caller can't present a matching one. True for the
   * browser claiming its own paid session (it needs a key to show the buyer);
   * false for the Stripe webhook, which must not silently retire the key the
   * customer is already using.
   */
  reissueIfUnknown?: boolean
}

/**
 * Credit a purchase to the buyer's account, creating the account on first
 * purchase. Safe to call any number of times for the same session id: exactly
 * one grant lands.
 */
export async function grantPurchase(opts: GrantOptions): Promise<GrantResult> {
  const email = normalizeEmail(opts.email)
  const credits = Math.max(0, Math.round(opts.credits))
  if (!isEmail(email)) throw new Error('A valid email is required to credit an account.')
  if (credits <= 0) throw new Error('Nothing to grant.')

  const db = getDatabase()

  // Create-or-find, race-safe: the webhook and the browser's claim call can
  // arrive at the same instant for a brand-new customer. `ON CONFLICT DO
  // NOTHING` (untargeted, so it covers whichever unique index fires) makes the
  // loser of that race fall through to the SELECT.
  let account = await accountForEmail(email)
  let isNewAccount = false
  let issuedKey: string | undefined

  if (!account) {
    const candidate = newAccessKey()
    const inserted = (await db.sql`
      INSERT INTO credit_accounts (email, key_hash)
      VALUES (${email}, ${hashKey(candidate)})
      ON CONFLICT DO NOTHING
      RETURNING id, email, key_hash, balance, lifetime_credits, created_at
    `) as any[]
    if (inserted[0]) {
      account = rowToAccount(inserted[0])
      isNewAccount = true
      issuedKey = candidate
    } else {
      account = await accountForEmail(email)
    }
  }
  if (!account) throw new Error('Could not open a credit account for that address.')

  // An existing account: hand back the key only if the caller can't already
  // prove it has one.
  if (!issuedKey && opts.reissueIfUnknown) {
    const presented = (opts.presentedKey ?? '').trim()
    const holdsThisAccount = presented
      ? (await accountForKey(presented))?.id === account.id
      : false
    if (!holdsThisAccount) issuedKey = await reissueKey(account.id)
  }

  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    // The ledger row is written first: its unique index on stripe_session_id is
    // what makes the whole grant idempotent. If it conflicts, this purchase was
    // already credited and the balance must not move again.
    const ledger = await client.query(
      `INSERT INTO credit_ledger (account_id, delta, reason, detail, stripe_session_id, amount_cents)
       VALUES ($1, $2, 'purchase', $3, $4, $5)
       ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [account.id, credits, opts.detail.slice(0, 300), opts.sessionId, Math.max(0, Math.round(opts.amountCents))],
    )
    if (ledger.rowCount === 0) {
      await client.query('ROLLBACK')
      const current = await accountForEmail(email)
      return {
        granted: false,
        account: current ?? account,
        balance: current?.balance ?? account.balance,
        credits: 0,
        issuedKey,
        isNewAccount,
      }
    }
    const updated = await client.query(
      `UPDATE credit_accounts
          SET balance = balance + $2,
              lifetime_credits = lifetime_credits + $2,
              lifetime_spend_cents = lifetime_spend_cents + $3,
              updated_at = now()
        WHERE id = $1
        RETURNING balance`,
      [account.id, credits, Math.max(0, Math.round(opts.amountCents))],
    )
    const balance = Number(updated.rows[0]?.balance ?? account.balance + credits)
    await client.query(`UPDATE credit_ledger SET balance_after = $2 WHERE id = $1`, [
      ledger.rows[0].id,
      balance,
    ])
    await client.query('COMMIT')
    return { granted: true, account: { ...account, balance }, balance, credits, issuedKey, isNewAccount }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// ---- spending ---------------------------------------------------------------

export interface ChargeResult {
  ok: boolean
  balance: number
  /** Ledger row id, so a failed run can be refunded against the exact charge. */
  ledgerId?: string
}

/**
 * Debit an account, atomically and only if it can afford it. The conditional
 * UPDATE is the whole guard: two runs starting at once cannot both spend the
 * last credit, because the second one's `balance >= amount` no longer holds.
 */
export async function chargeCredits(
  accountId: number,
  amount: number,
  detail: string,
): Promise<ChargeResult> {
  const cost = Math.max(0, Math.round(amount))
  const db = getDatabase()
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const updated = await client.query(
      `UPDATE credit_accounts SET balance = balance - $2, updated_at = now()
        WHERE id = $1 AND balance >= $2
        RETURNING balance`,
      [accountId, cost],
    )
    if (updated.rowCount === 0) {
      await client.query('ROLLBACK')
      const rows = (await db.sql`SELECT balance FROM credit_accounts WHERE id = ${accountId}`) as any[]
      return { ok: false, balance: Number(rows[0]?.balance ?? 0) }
    }
    const balance = Number(updated.rows[0].balance)
    const ledger = await client.query(
      `INSERT INTO credit_ledger (account_id, delta, reason, detail, balance_after)
       VALUES ($1, $2, 'agent_run', $3, $4) RETURNING id`,
      [accountId, -cost, detail.slice(0, 300), balance],
    )
    await client.query('COMMIT')
    return { ok: true, balance, ledgerId: String(ledger.rows[0].id) }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/**
 * Hand credits back when a charged run produced nothing usable. A customer must
 * never pay for an empty answer — that's the fastest way to lose a prepaid
 * balance customer for good.
 */
export async function refundCredits(
  accountId: number,
  amount: number,
  detail: string,
): Promise<number | null> {
  const credits = Math.max(0, Math.round(amount))
  if (credits === 0) return null
  const db = getDatabase()
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const updated = await client.query(
      `UPDATE credit_accounts SET balance = balance + $2, updated_at = now()
        WHERE id = $1 RETURNING balance`,
      [accountId, credits],
    )
    const balance = Number(updated.rows[0]?.balance ?? 0)
    await client.query(
      `INSERT INTO credit_ledger (account_id, delta, reason, detail, balance_after)
       VALUES ($1, $2, 'refund', $3, $4)`,
      [accountId, credits, detail.slice(0, 300), balance],
    )
    await client.query('COMMIT')
    return balance
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('credits: refund failed —', (err as Error).message)
    return null
  } finally {
    client.release()
  }
}

// ---- history, runs and artifacts -------------------------------------------

export interface LedgerEntry {
  delta: number
  reason: string
  detail: string | null
  balanceAfter: number | null
  createdAt: string | null
}

export async function recentLedger(accountId: number, limit = 12): Promise<LedgerEntry[]> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT delta, reason, detail, balance_after, created_at
    FROM credit_ledger WHERE account_id = ${accountId}
    ORDER BY created_at DESC, id DESC LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `) as any[]
  return rows.map((r) => ({
    delta: Number(r.delta),
    reason: String(r.reason),
    detail: r.detail ? String(r.detail) : null,
    balanceAfter: r.balance_after == null ? null : Number(r.balance_after),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }))
}

export interface RunRecord {
  accountId: number | null
  mode: string
  model: string
  credits: number
  inputTokens: number
  outputTokens: number
  steps: number
  brief: string
  status: 'ok' | 'empty' | 'error' | 'trial'
}

/** Record a run for the owner's margin reporting. Never throws. */
export async function recordRun(run: RunRecord): Promise<void> {
  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO agent_runs (account_id, mode, model, credits, input_tokens, output_tokens, steps, brief, status)
      VALUES (${run.accountId}, ${run.mode}, ${run.model}, ${run.credits}, ${run.inputTokens},
              ${run.outputTokens}, ${run.steps}, ${run.brief.slice(0, 600)}, ${run.status})
    `
  } catch (err) {
    console.error('credits: could not record run —', (err as Error).message)
  }
}

export interface ArtifactSummary {
  id: string
  title: string
  kind: string
  chars: number
  createdAt: string | null
}

export async function saveArtifact(
  accountId: number,
  title: string,
  body: string,
  kind = 'document',
): Promise<ArtifactSummary> {
  const db = getDatabase()
  const rows = (await db.sql`
    INSERT INTO agent_artifacts (account_id, title, kind, body)
    VALUES (${accountId}, ${title.slice(0, 200)}, ${kind.slice(0, 40)}, ${body.slice(0, 200_000)})
    RETURNING id, title, kind, length(body) AS chars, created_at
  `) as any[]
  const r = rows[0]
  return {
    id: String(r.id),
    title: String(r.title),
    kind: String(r.kind),
    chars: Number(r.chars),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }
}

export async function listArtifacts(accountId: number, limit = 20): Promise<ArtifactSummary[]> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, title, kind, length(body) AS chars, created_at
    FROM agent_artifacts WHERE account_id = ${accountId}
    ORDER BY created_at DESC, id DESC LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `) as any[]
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    kind: String(r.kind),
    chars: Number(r.chars),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }))
}

/** Fetch one artifact, scoped to its owner so an id alone reveals nothing. */
export async function getArtifact(
  accountId: number,
  id: string,
): Promise<(ArtifactSummary & { body: string }) | null> {
  if (!/^\d+$/.test(id)) return null
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, title, kind, body, length(body) AS chars, created_at
    FROM agent_artifacts WHERE account_id = ${accountId} AND id = ${Number(id)} LIMIT 1
  `) as any[]
  const r = rows[0]
  if (!r) return null
  return {
    id: String(r.id),
    title: String(r.title),
    kind: String(r.kind),
    chars: Number(r.chars),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    body: String(r.body),
  }
}

/** The public shape of a pack, for the page's pricing cards. */
export function packsForClient() {
  return CREDIT_PACKS.map((p) => ({
    id: p.id,
    label: p.label,
    credits: p.credits,
    bonus: p.bonus,
    total: packTotal(p),
    price: p.priceCents / 100,
    blurb: p.blurb,
  }))
}

/** The public shape of a mode, so the page always prices runs exactly as the
 * server charges for them. */
export function modesForClient() {
  return AGENT_MODES.map((m) => ({
    id: m.id,
    label: m.label,
    credits: m.credits,
    blurb: m.blurb,
    // The model name is customer-facing on purpose: "runs on Claude Opus 5" is
    // the product.
    model: m.model,
  }))
}
