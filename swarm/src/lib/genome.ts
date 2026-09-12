import { PRODUCTS, SITE, productBySku } from "./catalog";
import type { Channel, GeneratedCopy, IntentPulse, Organism, Product } from "./types";
import { clamp, uid } from "./utils";

export const CHANNELS: { id: Channel; label: string; native: string }[] = [
  { id: "search", label: "Search intercept", native: "Answers the query they already typed" },
  { id: "conversation", label: "Conversation native", native: "Reads as a reply, not a banner" },
  { id: "proof", label: "Proof-loop", native: "The spec sheet is the ad" },
  { id: "shadow", label: "Shadow listing", native: "Sits next to 'what should I use' threads" },
];

export const CHANNEL_META: Record<
  Channel,
  { ctr: number; cvr: number; cpc: number; bonus: number }
> = {
  search: { ctr: 0.032, cvr: 0.041, cpc: 1.85, bonus: 1 },
  conversation: { ctr: 0.019, cvr: 0.036, cpc: 0.42, bonus: 0.95 },
  proof: { ctr: 0.068, cvr: 0.072, cpc: 0.9, bonus: 1.18 },
  shadow: { ctr: 0.024, cvr: 0.048, cpc: 0.55, bonus: 1.06 },
};

const CTAS = ["Watch the run", "Open the spec", "Get the instrument", "See it work on your task"];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length]!;
}

export function buildLanding(product: Product, channel: Channel, swarmId: string, orgId: string) {
  const path = channel === "proof" ? "/proof" : product.landing;
  const url = new URL(path, SITE);
  url.searchParams.set("utm_source", "swarm");
  url.searchParams.set("utm_medium", channel);
  url.searchParams.set("utm_campaign", swarmId);
  url.searchParams.set("utm_content", orgId);
  url.searchParams.set("sku", product.sku);
  return url.toString();
}

export function localCopy(product: Product, intent: string, channel: Channel, salt: number): GeneratedCopy {
  const cta = pick(CTAS, salt);
  const variant = salt % 3;
  const proofLead = product.proof.split("—")[0]!.trim();
  const intentLine = intent.replace(/[.?!]$/, "");
  if (channel === "search") {
    const headlines = [
      proofLead,
      `${product.name} — $${product.price} one-time`,
      intentLine,
    ];
    const bodies = [
      `${product.job}. ${product.pain} Spec sheet, not a pitch. $${product.price}, one-time.`,
      `${product.proof}. ${product.job}.`,
      `Not a Google tax. ${product.proof}. $${product.price}, watch it on your task.`,
    ];
    return { channel, headline: headlines[variant]!, body: bodies[variant]!, proofHook: product.proof, cta };
  }
  if (channel === "conversation") {
    const headlines = [
      intentLine,
      product.pain.replace(/[.?!]$/, ""),
      product.job.replace(/[.?!]$/, ""),
    ];
    const bodies = [
      `${product.proof}. Not a wrapper — ${product.format.toLowerCase()} you keep. $${product.price}, watch it run first.`,
      `I ran ${product.name} on the actual job. ${product.proof}. Public run: ${SITE}/proof`,
      `${product.proof}. $${product.price} one-time, no subscription.`,
    ];
    return { channel, headline: headlines[variant]!, body: bodies[variant]!, proofHook: product.proof, cta };
  }
  if (channel === "proof") {
    const headlines = [`SPEC ${product.sku}`, `SPEC ${product.sku} · $${product.price}`, `${product.name} spec`];
    const bodies = [
      `Job: ${product.job}. Proof: ${product.proof}. Cost: $${product.price} perpetual. First run is free to watch.`,
      `Built for ${product.role}. ${product.proof}. $${product.price} one-time.`,
      `${product.job}. Watch it on your own task before you pay. $${product.price}.`,
    ];
    return { channel, headline: headlines[variant]!, body: bodies[variant]!, proofHook: product.proof, cta: "Watch the run" };
  }
  const article = /^[aeiou]/i.test(product.format) ? "an" : "a";
  const headlines = [product.job, proofLead, `${product.name} vs the wrapper`];
  const bodies = [
    `${product.name} is ${article} ${product.format.toLowerCase()} — you can watch it run on your own task before paying. $${product.price}, no subscription.`,
    `${product.proof}. Sits next to the “what should I use” thread. $${product.price}.`,
    `Not another summarizer. ${product.job}. $${product.price} one-time.`,
  ];
  return { channel, headline: headlines[variant]!, body: bodies[variant]!, proofHook: product.proof, cta };
}

export function copyToOrganism(opts: {
  copy: GeneratedCopy;
  product: Product;
  swarmId: string;
  intent: string;
  generation: number;
  parentIds?: string[];
}): Organism {
  const id = uid("org");
  return {
    id,
    swarmId: opts.swarmId,
    sku: opts.product.sku,
    channel: opts.copy.channel,
    generation: opts.generation,
    parentIds: opts.parentIds ?? [],
    headline: opts.copy.headline,
    body: opts.copy.body,
    proofHook: opts.copy.proofHook,
    cta: opts.copy.cta,
    landingUrl: buildLanding(opts.product, opts.copy.channel, opts.swarmId, id),
    targetIntent: opts.intent,
    status: "alive",
    fitness: 12 + (hash32(opts.intent + opts.copy.headline) % 80) / 10,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    createdAt: Date.now(),
  };
}

export function spawnLocalSwarm(opts: {
  swarmId: string;
  product: Product;
  intent: string;
  generation?: number;
  perChannel?: number;
}): Organism[] {
  const per = opts.perChannel ?? 2;
  const gen = opts.generation ?? 1;
  const out: Organism[] = [];
  const used = new Set<string>();
  CHANNELS.forEach((ch, ci) => {
    for (let i = 0; i < per; i++) {
      let copy = localCopy(opts.product, opts.intent, ch.id, ci * 7 + i * 3 + gen * 11);
      let guard = 0;
      while (used.has(headlineKey(copy.headline)) && guard < 6) {
        copy = localCopy(opts.product, opts.intent, ch.id, ci * 7 + i * 3 + gen * 11 + guard + 1);
        guard += 1;
      }
      used.add(headlineKey(copy.headline));
      out.push(
        copyToOrganism({
          copy,
          product: opts.product,
          swarmId: opts.swarmId,
          intent: opts.intent,
          generation: gen,
        }),
      );
    }
  });
  return out;
}

function headlineKey(headline: string) {
  return headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scoreOrganism(o: Organism, price: number) {
  const ctr = o.clicks / Math.max(o.impressions, 1);
  const cvr = o.conversions / Math.max(o.clicks, 1);
  const roas = (o.conversions * price) / Math.max(o.spend, 0.01);
  const bonus = CHANNEL_META[o.channel].bonus;
  const proofBias = /watch|run|spec|proof|minute|cit/i.test(`${o.headline} ${o.proofHook}`)
    ? 1.08
    : 0.96;
  return clamp((ctr * 42 + cvr * 90 + Math.min(roas, 12) * 6) * bonus * proofBias, 0, 100);
}

export function tickOrganisms(organisms: Organism[], hours: number, dailyBudget: number): Organism[] {
  const sim = organisms.filter((o) => o.status === "alive" || o.status === "champion");
  if (sim.length === 0) return organisms;
  const share = dailyBudget / 24 / sim.length;
  return organisms.map((o) => {
    if (o.status === "killed" || o.status === "live") return o;
    const product = productBySku(o.sku);
    const meta = CHANNEL_META[o.channel];
    const rng = mulberry32(hash32(`${o.id}:${o.impressions}:${hours}`));
    let impressions = o.impressions;
    let clicks = o.clicks;
    let conversions = o.conversions;
    let spend = o.spend;
    for (let h = 0; h < hours; h++) {
      const heat = 0.7 + rng() * 0.6;
      const quality = 0.85 + (o.fitness / 100) * 0.4;
      const imps = Math.max(4, Math.round((share / meta.cpc) * 18 * heat * quality * (0.7 + rng() * 0.6)));
      const c = Math.round(imps * meta.ctr * quality * (0.75 + rng() * 0.5));
      const v = Math.round(c * meta.cvr * quality * (0.7 + rng() * 0.55));
      const s = c * meta.cpc * (0.85 + rng() * 0.3);
      impressions += imps;
      clicks += c;
      conversions += v;
      spend += s;
    }
    const next: Organism = {
      ...o,
      impressions,
      clicks,
      conversions,
      spend,
    };
    next.fitness = scoreOrganism(next, product?.price ?? 29);
    return next;
  });
}

export function markChampions(organisms: Organism[]): Organism[] {
  const bySwarm = new Map<string, Organism[]>();
  for (const o of organisms) {
    const list = bySwarm.get(o.swarmId) ?? [];
    list.push(o);
    bySwarm.set(o.swarmId, list);
  }
  const champIds = new Set<string>();
  for (const list of bySwarm.values()) {
    const alive = list.filter((o) => o.status !== "killed");
    alive.sort((a, b) => b.fitness - a.fitness);
    if (alive[0] && alive[0].fitness > 0) champIds.add(alive[0].id);
  }
  return organisms.map((o) => {
    if (o.status === "killed" || o.status === "live") return o;
    if (champIds.has(o.id)) return { ...o, status: "champion" as const };
    if (o.status === "champion") return { ...o, status: "alive" as const };
    return o;
  });
}

export function cullDuplicates(organisms: Organism[]): Organism[] {
  const kill = new Set<string>();
  const bySwarm = new Map<string, Organism[]>();
  for (const o of organisms) {
    const list = bySwarm.get(o.swarmId) ?? [];
    list.push(o);
    bySwarm.set(o.swarmId, list);
  }
  for (const list of bySwarm.values()) {
    const alive = list.filter((o) => o.status !== "killed" && o.status !== "live").sort((a, b) => b.fitness - a.fitness);
    const perChannel = new Map<Channel, number>();
    const used = new Set<string>();
    for (const o of alive) {
      const key = `${o.channel}:${headlineKey(o.headline)}`;
      const n = perChannel.get(o.channel) ?? 0;
      if (n >= 2 || used.has(key)) {
        kill.add(o.id);
        continue;
      }
      perChannel.set(o.channel, n + 1);
      used.add(key);
    }
  }
  if (kill.size === 0) return organisms;
  return organisms.map((o) => (kill.has(o.id) ? { ...o, status: "killed" as const } : o));
}

export function evolveLocal(opts: {
  swarmId: string;
  generation: number;
  organisms: Organism[];
}): { killed: string[]; born: Organism[] } {
  const lab = opts.organisms
    .filter((o) => o.swarmId === opts.swarmId && o.status !== "killed" && o.status !== "live")
    .sort((a, b) => b.fitness - a.fitness);
  const locked = opts.organisms.filter((o) => o.swarmId === opts.swarmId && o.status === "live");
  if (lab.length === 0 && locked.length === 0) return { killed: [], born: [] };
  const champion = lab[0] ?? locked[0]!;
  const product = productBySku(champion.sku) ?? PRODUCTS[0]!;
  const intent = champion.targetIntent;
  const keep = new Set<string>(locked.map((o) => o.id));
  if (lab[0]) keep.add(lab[0].id);
  for (const ch of CHANNELS) {
    const best = lab.find((o) => o.channel === ch.id);
    if (best) keep.add(best.id);
  }
  const killed = lab.filter((o) => !keep.has(o.id)).map((o) => o.id);
  const used = new Set(
    [...locked, ...lab.filter((o) => keep.has(o.id))].map((o) => headlineKey(o.headline)),
  );
  const born: Organism[] = [];
  CHANNELS.forEach((ch, i) => {
    const parent = lab.find((o) => o.channel === ch.id) ?? champion;
    for (let attempt = 0; attempt < 5; attempt++) {
      const copy = localCopy(product, intent, ch.id, opts.generation * 17 + i * 5 + attempt + 3);
      const key = headlineKey(copy.headline);
      if (used.has(key)) continue;
      used.add(key);
      born.push(
        copyToOrganism({
          copy,
          product,
          swarmId: opts.swarmId,
          intent,
          generation: opts.generation,
          parentIds: [parent.id, champion.id],
        }),
      );
      break;
    }
  });
  return { killed, born };
}

export function packetMarkdown(organisms: Organism[]) {
  const alive = organisms.filter((o) => o.status !== "killed");
  const lines = [
    `# SWARM deploy packet`,
    ``,
    `Intent-hijack ads for MultiNiche AI. Proof first. No slogans.`,
    ``,
  ];
  for (const ch of CHANNELS) {
    const set = alive.filter((o) => o.channel === ch.id);
    if (!set.length) continue;
    lines.push(`## ${ch.label}`);
    lines.push(``);
    for (const o of set) {
      const p = productBySku(o.sku);
      lines.push(`### ${p?.name ?? o.sku} · gen ${o.generation}`);
      lines.push(`Intent: ${o.targetIntent}`);
      lines.push(`Headline: ${o.headline}`);
      lines.push(`Body: ${o.body}`);
      lines.push(`Proof: ${o.proofHook}`);
      lines.push(`CTA: ${o.cta}`);
      lines.push(`URL: ${o.landingUrl}`);
      lines.push(``);
    }
  }
  return lines.join("\n");
}

export const INTENT_POOL: { text: string; source: IntentPulse["source"]; sku: string; heat: number }[] =
  PRODUCTS.flatMap((p, i) => {
    const sources: IntentPulse["source"][] = ["search", "x", "reddit", "forum"];
    return p.utterances.slice(0, 2).map((text, j) => ({
      text,
      source: sources[(i + j) % sources.length]!,
      sku: p.sku,
      heat: 42 + ((i * 13 + j * 19) % 48),
    }));
  });

export function pulseFromPool(index: number, now = 0): IntentPulse {
  const item = INTENT_POOL[index % INTENT_POOL.length]!;
  const rng = mulberry32(hash32(`${item.sku}:${index}:seed`));
  return {
    id: `pulse_${index}`,
    text: item.text,
    source: item.source,
    sku: item.sku,
    heat: clamp(item.heat + Math.round((rng() - 0.5) * 18), 18, 99),
    angle: (hash32(item.text) % 3600) / 10,
    radius: 18 + (hash32(item.sku + item.text) % 70),
    ts: now,
  };
}

export function livePulse(index: number, now = Date.now()): IntentPulse {
  const base = pulseFromPool(index, now);
  return { ...base, id: `pulse_${index}_${Math.floor(now / 1000)}` };
}

export function seedPulses(count = 14): IntentPulse[] {
  return Array.from({ length: count }, (_, i) => pulseFromPool(i * 3 + 1, 0));
}

export const SEED_SWARM_ID = "swarm_seed_mn";

export function seedOrganisms(): Organism[] {
  const product = productBySku("AI-AB-002")!;
  const intent = product.utterances[0]!;
  const base = spawnLocalSwarm({
    swarmId: SEED_SWARM_ID,
    product,
    intent,
    generation: 1,
    perChannel: 2,
  });
  const all = base.map((o, i) => {
    const id = `org_seed_${String(i + 1).padStart(2, "0")}`;
    return {
      ...o,
      id,
      landingUrl: buildLanding(product, o.channel, SEED_SWARM_ID, id),
    };
  });
  return tickOrganisms(all, 8, 48);
}
