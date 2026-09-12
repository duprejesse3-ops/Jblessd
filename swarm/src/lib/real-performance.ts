import { SITE } from "./catalog";
import { CHANNEL_META } from "./genome";
import type { Organism } from "./types";
import { clamp } from "./utils";

// Closes the loop the rest of SWARM never closes: every organism's
// landingUrl carries utm_source=swarm&utm_campaign=<swarmId>&utm_content=
// <orgId>, pointing at real pages on multinicheai.com. Those pages already
// log first-party landings and purchases (ad_events, via /api/track-landing
// and the checkout webhooks) — this just reads that back, keyed by orgId, so
// a "live" organism's stats stop being tickOrganisms()'s simulated random
// walk and become what the post actually did.
//
// tickOrganisms() already skips status "live" organisms (see genome.ts —
// `if (o.status === "killed" || o.status === "live") return o;`), so a live
// organism's simulated fields are frozen at whatever they were the moment it
// went live. Overwriting those frozen fields here is safe: nothing else is
// still writing to them.

export interface RealPerformanceEntry {
  landings: number;
  purchases: number;
  revenue: number;
  lastSeen: string;
}

export type RealPerformanceMap = Record<string, RealPerformanceEntry>;

interface SwarmPerformanceApiRow {
  swarmId: string;
  orgId: string;
  landings: number;
  purchases: number;
  revenue: number;
  lastSeen: string;
}

interface SwarmPerformanceApiResponse {
  windowDays: number;
  asOf: string;
  organisms: SwarmPerformanceApiRow[];
}

/** Fetch the real-performance map, keyed by orgId (utm_content). */
export async function fetchRealPerformance(days = 30): Promise<RealPerformanceMap> {
  const res = await fetch(`${SITE}/api/swarm-performance?days=${days}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`swarm-performance ${res.status}`);
  const data = (await res.json()) as SwarmPerformanceApiResponse;
  const map: RealPerformanceMap = {};
  for (const row of data.organisms) {
    map[row.orgId] = {
      landings: row.landings,
      purchases: row.purchases,
      revenue: row.revenue,
      lastSeen: row.lastSeen,
    };
  }
  return map;
}

/**
 * Fitness for a "live" organism grounded in what actually happened, not the
 * simulated CTR/CVR table. There's no real impression count for an organic
 * X/Reddit post and no real spend outside the Google Ads channel, so this
 * isn't scoreOrganism()'s ctr/roas shape — it rewards real conversion rate
 * (purchases / landings) and real revenue density, with a volume floor so a
 * single lucky sale on one landing doesn't outscore a channel proving itself
 * across dozens.
 */
export function realFitness(entry: RealPerformanceEntry, channel: Organism["channel"], price: number) {
  const landings = entry.landings;
  const cvr = entry.purchases / Math.max(landings, 1);
  const revenuePerLanding = entry.revenue / Math.max(landings, 1);
  const volume = clamp(Math.log2(landings + 1) * 6, 0, 24);
  const bonus = CHANNEL_META[channel].bonus;
  return clamp((cvr * 140 + Math.min(revenuePerLanding / Math.max(price, 1), 3) * 18 + volume) * bonus, 0, 100);
}

/**
 * Registers an organism's real copy with multinicheai.com the moment it
 * actually goes live, so the public scorecard has something to join real
 * performance against. Best-effort and fire-and-forget — a failed register
 * must never block goLive() itself; the organism still ships to X/Reddit/
 * Google Ads either way, it just won't show up on the public page.
 */
export async function registerOrganism(o: Organism) {
  try {
    await fetch(`${SITE}/api/swarm-register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: o.id,
        swarmId: o.swarmId,
        sku: o.sku,
        channel: o.channel,
        headline: o.headline,
        body: o.body,
        proofHook: o.proofHook,
        landingUrl: o.landingUrl,
      }),
      keepalive: true,
    });
  } catch {
    // offline or endpoint unreachable — the post itself already shipped
  }
}

/**
 * Overwrite live organisms' frozen simulated stats with real ones. Organisms
 * with no real data yet (posted very recently, or never actually clicked
 * through) are left untouched rather than zeroed out — no traffic yet isn't
 * evidence of failure, just absence of data.
 */
export function applyRealPerformance(
  organisms: Organism[],
  real: RealPerformanceMap,
  priceOf: (sku: string) => number,
): Organism[] {
  return organisms.map((o) => {
    if (o.status !== "live" && o.status !== "champion") return o;
    const entry = real[o.id];
    if (!entry || entry.landings <= 0) return o;
    const next: Organism = {
      ...o,
      clicks: entry.landings,
      conversions: entry.purchases,
      impressions: Math.max(o.impressions, entry.landings),
      verifiedLandings: entry.landings,
      verifiedRevenue: entry.revenue,
      verifiedAt: entry.lastSeen,
    };
    next.fitness = realFitness(entry, o.channel, priceOf(o.sku));
    return next;
  });
}
