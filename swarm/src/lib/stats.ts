import type { Organism, Swarm } from "./types";

export function totals(organisms: Organism[]) {
  const live = organisms.filter((o) => o.status !== "killed");
  const impressions = live.reduce((a, o) => a + o.impressions, 0);
  const clicks = live.reduce((a, o) => a + o.clicks, 0);
  const conversions = live.reduce((a, o) => a + o.conversions, 0);
  const spend = live.reduce((a, o) => a + o.spend, 0);
  const ctr = clicks / Math.max(impressions, 1);
  const cvr = conversions / Math.max(clicks, 1);
  return { live: live.length, impressions, clicks, conversions, spend, ctr, cvr };
}

export function byChannel(organisms: Organism[]) {
  const map: Record<string, ReturnType<typeof totals>> = {};
  for (const o of organisms) {
    if (o.status === "killed") continue;
    const list = organisms.filter((x) => x.channel === o.channel && x.status !== "killed");
    map[o.channel] = totals(list);
  }
  return map;
}

export function hoursLabel(hours: number) {
  if (hours < 24) return `${hours}h simulated`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h ? `${d}d ${h}h simulated` : `${d}d simulated`;
}

export function droughtSeries() {
  const days = Array.from({ length: 14 }, (_, i) => i + 1);
  return days.map((day) => {
    const interrupt = Math.round(4 * Math.log(day + 1) + (day > 8 ? (day - 8) * 1.2 : 0));
    const hijack = Math.round(2 + day * 6.4 + (day > 4 ? (day - 4) ** 1.35 * 2.1 : 0));
    return { day: `D${day}`, interrupt, hijack };
  });
}

export function swarmOf(swarms: Swarm[], id: string | null) {
  return swarms.find((s) => s.id === id) ?? swarms[0];
}
