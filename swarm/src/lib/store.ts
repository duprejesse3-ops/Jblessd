import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRODUCTS, productBySku } from "./catalog";
import {
  SEED_SWARM_ID,
  copyToOrganism,
  cullDuplicates,
  evolveLocal,
  livePulse,
  markChampions,
  seedExtraSwarms,
  seedOrganisms,
  seedPulses,
  spawnLocalSwarm,
  tickOrganisms,
} from "./genome";
import type { Activity, Destinations, GeneratedCopy, IntentPulse, LiveHit, Organism, Swarm } from "./types";
import { uid } from "./utils";
import { DEFAULT_DESTINATIONS } from "./deploy";
import { applyRealPerformance, fetchRealPerformance, registerOrganism } from "./real-performance";

type SwarmState = {
  hydrated: boolean;
  swarms: Swarm[];
  organisms: Organism[];
  pulses: IntentPulse[];
  selectedId: string | null;
  pulseCursor: number;
  autopilot: boolean;
  activities: Activity[];
  lastAutoHijackAt: number;
  lastAutoEvolveAt: number;
  lastLiveScanAt: number;
  lastRealSyncAt: number;
  destinations: Destinations;
  setHydrated: () => void;
  select: (id: string | null) => void;
  toggleRun: (swarmId: string) => void;
  retireSwarm: (swarmId: string) => void;
  setAutopilot: (on: boolean) => void;
  tick: (hours?: number) => void;
  syncRealPerformance: () => Promise<void>;
  listen: () => void;
  autoStep: () => void;
  hijack: (opts: {
    sku: string;
    intent: string;
    copies?: GeneratedCopy[];
    name?: string;
  }) => string;
  evolve: (swarmId: string, copies?: GeneratedCopy[]) => void;
  kill: (id: string) => void;
  goLive: (id: string) => void;
  pullFromLive: (id: string) => void;
  setBudget: (swarmId: string, dailyBudget: number) => void;
  setDestinations: (patch: Partial<Destinations>) => void;
  ingestLive: (hits: LiveHit[]) => string | null;
  resetLab: () => void;
};

function seedSwarms(): Swarm[] {
  return [
    {
      id: SEED_SWARM_ID,
      name: "Inbox drought intercept",
      generation: 1,
      dailyBudget: 48,
      running: true,
      startedAt: Date.now() - 8 * 3600 * 1000,
      simulatedHours: 8,
    },
  ];
}

function log(kind: Activity["kind"], text: string): Activity {
  return { id: uid("log"), ts: Date.now(), kind, text };
}

function initial(): Pick<
  SwarmState,
  | "swarms"
  | "organisms"
  | "pulses"
  | "selectedId"
  | "pulseCursor"
  | "autopilot"
  | "activities"
  | "lastAutoHijackAt"
  | "lastAutoEvolveAt"
  | "lastLiveScanAt"
  | "lastRealSyncAt"
  | "destinations"
> {
  const extra = seedExtraSwarms(4);
  return {
    swarms: [...seedSwarms(), ...extra.swarms],
    organisms: markChampions(
      cullDuplicates([...seedOrganisms(), ...extra.organisms]),
    ),
    pulses: seedPulses(16),
    selectedId: "org_seed_01",
    pulseCursor: 16,
    autopilot: true,
    activities: [
      {
        id: "log_seed",
        ts: 0,
        kind: "pilot",
        text: "Autopilot armed. Hijack, run, and evolve without a click.",
      },
    ],
    lastAutoHijackAt: 0,
    lastAutoEvolveAt: 0,
    lastLiveScanAt: 0,
    lastRealSyncAt: 0,
    destinations: { ...DEFAULT_DESTINATIONS },
  };
}

export const useSwarmStore = create<SwarmState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...initial(),
      setHydrated: () => set({ hydrated: true }),
      select: (id) => set({ selectedId: id }),
      toggleRun: (swarmId) =>
        set((s) => ({
          swarms: s.swarms.map((sw) =>
            sw.id === swarmId
              ? {
                  ...sw,
                  running: !sw.running,
                  startedAt: !sw.running ? Date.now() : sw.startedAt,
                }
              : sw,
          ),
        })),
      // Called by autoStep once a swarm graduates past its generation
      // ceiling (see the "graduated" check there). Kept as a separate,
      // named action — rather than folded inline — so it's independently
      // testable and so a person can trigger it by hand from the UI later
      // without duplicating the logic.
      //
      // Only non-"live" organisms get killed: a live organism is real
      // running traffic, and retirement should never yank that out from
      // under a buyer-facing post just because its swarm hit a generation
      // ceiling. The swarm's SKU stays usable for the next autopilot
      // hijack regardless, because the used-SKU check in autoStep only
      // looks at running swarms — see the comment there.
      retireSwarm: (swarmId) =>
        set((s) => {
          const swarm = s.swarms.find((sw) => sw.id === swarmId);
          if (!swarm) return s;
          return {
            swarms: s.swarms.map((sw) =>
              sw.id === swarmId ? { ...sw, running: false, retired: true } : sw,
            ),
            organisms: s.organisms.map((o) =>
              o.swarmId === swarmId && o.status !== "live" ? { ...o, status: "killed" as const } : o,
            ),
            activities: [
              log(
                "pilot",
                `Retired ${swarm.name} at gen ${swarm.generation} — freeing the slot for a product that hasn't been tried yet.`,
              ),
              ...s.activities,
            ].slice(0, 24),
          };
        }),
      setAutopilot: (on) =>
        set((s) => ({
          autopilot: on,
          // A retired swarm is deliberately excluded here: switching
          // autopilot back on should resume swarms the person (or a
          // cooldown) paused, not resurrect one that already graduated —
          // otherwise every autopilot-on click would instantly re-fill
          // the cap with the same handful of already-tried products.
          swarms: on ? s.swarms.map((sw) => (sw.retired ? sw : { ...sw, running: true })) : s.swarms,
          activities: [log("pilot", on ? "Autopilot on." : "Autopilot paused."), ...s.activities].slice(
            0,
            24,
          ),
        })),
      tick: (hours = 1) => {
        const { swarms, organisms } = get();
        let next = organisms;
        const nextSwarms = swarms.map((sw) => {
          if (!sw.running) return sw;
          const ticked = tickOrganisms(
            next.filter((o) => o.swarmId === sw.id),
            hours,
            sw.dailyBudget,
          );
          const map = new Map(ticked.map((o) => [o.id, o]));
          next = next.map((o) => map.get(o.id) ?? o);
          return { ...sw, simulatedHours: sw.simulatedHours + hours };
        });
        if (next === organisms) return;
        set({ organisms: markChampions(cullDuplicates(next)), swarms: nextSwarms });
      },
      // Replaces "live" organisms' frozen simulated stats with what their
      // posts actually did on multinicheai.com (real landings/purchases from
      // ad_events, via /api/swarm-performance). Best-effort: a fetch failure
      // (offline, endpoint down) just means fitness stays on its last known
      // value — never throws into the autopilot loop.
      syncRealPerformance: async () => {
        try {
          const real = await fetchRealPerformance();
          const { organisms } = get();
          const priceOf = (sku: string) => productBySku(sku)?.price ?? 29;
          const next = applyRealPerformance(organisms, real, priceOf);
          if (next === organisms) return;
          const changed = next.some((o, i) => o !== organisms[i]);
          if (!changed) return;
          set((s) => ({
            organisms: markChampions(next),
            lastRealSyncAt: Date.now(),
            activities: [
              log("real", "Synced real performance from multinicheai.com."),
              ...s.activities,
            ].slice(0, 24),
          }));
        } catch {
          // offline or endpoint unreachable — leave stats as they were
        }
      },
      listen: () =>
        set((s) => {
          const pulse = livePulse(s.pulseCursor + 1);
          const pulses = [pulse, ...s.pulses].slice(0, 28);
          return { pulses, pulseCursor: s.pulseCursor + 1 };
        }),
      autoStep: () => {
        const s = get();
        if (!s.autopilot) return;
        s.tick(1);
        s.listen();
        const now = Date.now();
        const after = get();
        const ripe = after.swarms.find(
          (sw) =>
            sw.running &&
            sw.generation < 6 &&
            sw.simulatedHours >= sw.generation * 16 &&
            now - after.lastAutoEvolveAt > 14000,
        );
        if (ripe) {
          after.evolve(ripe.id);
          set((cur) => ({
            lastAutoEvolveAt: now,
            activities: [
              log("evolve", `Auto-evolved ${ripe.name} → gen ${ripe.generation + 1}.`),
              ...cur.activities,
            ].slice(0, 24),
          }));
          return;
        }
        // A swarm that has hit its generation ceiling used to just sit
        // here forever: not "ripe" (generation < 6 fails), so it was
        // never evolved again, but still running and still holding both
        // a cap slot and its SKU — permanently, since nothing else in the
        // app ever un-hijacks a swarm. Once 5 swarms existed, autopilot
        // would silently stop introducing new products for good, no
        // matter how long it kept running. This is what "graduated"
        // fixes: reaching the ceiling now retires the swarm and frees its
        // slot immediately, instead of freezing the roster in place.
        const graduated = after.swarms.find(
          (sw) => sw.running && sw.generation >= 6 && now - after.lastAutoEvolveAt > 14000,
        );
        if (graduated) {
          after.retireSwarm(graduated.id);
          set({ lastAutoEvolveAt: now });
          return;
        }
        // Retired and manually-paused swarms are excluded from both the
        // used-SKU set and the concurrent-swarm cap below — only
        // currently-running swarms hold a slot. This is what makes
        // retirement (and a manual pause) actually free up rotation
        // instead of permanently locking that SKU out of future hijacks.
        const runningSwarmIds = new Set(after.swarms.filter((sw) => sw.running).map((sw) => sw.id));
        const used = new Set(
          after.organisms
            .filter((o) => o.status !== "killed" && runningSwarmIds.has(o.swarmId))
            .map((o) => o.sku),
        );
        const pulse = after.pulses.find((p) => !used.has(p.sku));
        if (pulse && runningSwarmIds.size < 5 && now - after.lastAutoHijackAt > 18000) {
          get().hijack({ sku: pulse.sku, intent: pulse.text });
          set({ lastAutoHijackAt: now });
        }
        if (now - after.lastRealSyncAt > 60000 && after.organisms.some((o) => o.status === "live")) {
          set({ lastRealSyncAt: now }); // claim the slot before the await so overlapping ticks don't double-fire
          void get().syncRealPerformance();
        }
      },
      hijack: ({ sku, intent, copies, name }) => {
        const product = productBySku(sku) ?? PRODUCTS[0]!;
        const swarmId = uid("swarm");
        const swarm: Swarm = {
          id: swarmId,
          name: name ?? `Hijack · ${product.name}`,
          generation: 1,
          dailyBudget: 36,
          running: true,
          startedAt: Date.now(),
          simulatedHours: 0,
        };
        let born: Organism[];
        if (copies && copies.length) {
          born = copies.map((copy) =>
            copyToOrganism({
              copy,
              product,
              swarmId,
              intent,
              generation: 1,
            }),
          );
        } else {
          born = spawnLocalSwarm({ swarmId, product, intent, generation: 1 });
        }
        born = tickOrganisms(born, 2, swarm.dailyBudget);
        set((s) => ({
          swarms: [swarm, ...s.swarms],
          organisms: [...born, ...s.organisms],
          selectedId: born[0]?.id ?? s.selectedId,
          activities: [
            log("hijack", `Spawned ${born.length} organisms for ${product.name}.`),
            ...s.activities,
          ].slice(0, 24),
        }));
        return swarmId;
      },
      evolve: (swarmId, copies) => {
        const { organisms, swarms } = get();
        const swarm = swarms.find((s) => s.id === swarmId);
        if (!swarm) return;
        const generation = swarm.generation + 1;
        const local = evolveLocal({ swarmId, generation, organisms });
        const product =
          productBySku(organisms.find((o) => o.swarmId === swarmId)?.sku ?? "") ?? PRODUCTS[0]!;
        const intent =
          organisms.find((o) => o.swarmId === swarmId)?.targetIntent ?? product.utterances[0]!;
        let born = local.born;
        if (copies && copies.length) {
          born = [
            ...copies.map((copy) =>
              copyToOrganism({
                copy,
                product,
                swarmId,
                intent,
                generation,
                parentIds: local.born[0]?.parentIds ?? [],
              }),
            ),
            ...born.slice(0, 2),
          ];
        }
        const killedSet = new Set(local.killed);
        const curSel = get().selectedId;
        const curOrg = organisms.find((o) => o.id === curSel);
        set({
          swarms: swarms.map((s) => (s.id === swarmId ? { ...s, generation } : s)),
          organisms: markChampions(
            cullDuplicates([
              ...born,
              ...organisms.map((o) =>
                killedSet.has(o.id) && o.status !== "live" ? { ...o, status: "killed" as const } : o,
              ),
            ]),
          ),
          selectedId: curOrg?.status === "live" ? curSel : (born[0]?.id ?? curSel),
        });
      },
      kill: (id) =>
        set((s) => ({
          organisms: s.organisms.map((o) =>
            o.id === id && o.status !== "live" ? { ...o, status: "killed" as const } : o,
          ),
        })),
      goLive: (id) =>
        set((s) => {
          const org = s.organisms.find((o) => o.id === id);
          if (!org || org.status === "killed") return s;
          void registerOrganism(org);
          return {
            selectedId: id,
            organisms: s.organisms.map((o) =>
              o.id === id ? { ...o, status: "live" as const, liveAt: Date.now() } : o,
            ),
            activities: [
              log("live", `Went live · ${org.channel} · ${org.headline}`),
              ...s.activities,
            ].slice(0, 24),
          };
        }),
      pullFromLive: (id) =>
        set((s) => ({
          organisms: s.organisms.map((o) =>
            o.id === id && o.status === "live"
              ? { ...o, status: "champion" as const, liveAt: undefined }
              : o,
          ),
        })),
      setBudget: (swarmId, dailyBudget) =>
        set((s) => ({
          swarms: s.swarms.map((sw) => (sw.id === swarmId ? { ...sw, dailyBudget } : sw)),
        })),
      setDestinations: (patch) =>
        set((s) => ({
          destinations: {
            ...DEFAULT_DESTINATIONS,
            ...s.destinations,
            ...patch,
          },
        })),
      ingestLive: (hits) => {
        const now = Date.now();
        const pulses = hits.map((h, i) => ({
          id: `live_${now}_${i}`,
          text: h.text,
          source: "x" as const,
          sku: h.sku,
          heat: h.heat,
          angle: (i * 37) % 360,
          radius: 22 + ((i * 9) % 60),
          ts: now,
          postUrl: h.url || undefined,
          handle: h.handle || undefined,
          live: true,
        }));
        set((s) => ({
          pulses: [...pulses, ...s.pulses.filter((p) => !p.live)].slice(0, 28),
          lastLiveScanAt: now,
          activities: [
            log("scan", `Live X scan · ${pulses.length} real posts.`),
            ...s.activities,
          ].slice(0, 24),
        }));
        return pulses[0]?.id ?? null;
      },
      resetLab: () => set({ ...initial(), destinations: get().destinations, hydrated: true }),
    }),
    {
      name: "swarm-mn-v3",
      skipHydration: true,
      partialize: (s) => ({
        swarms: s.swarms,
        organisms: s.organisms,
        selectedId: s.selectedId,
        pulseCursor: s.pulseCursor,
        autopilot: s.autopilot,
        pulses: s.pulses,
        activities: s.activities,
        lastAutoHijackAt: s.lastAutoHijackAt,
        lastAutoEvolveAt: s.lastAutoEvolveAt,
        lastLiveScanAt: s.lastLiveScanAt,
        lastRealSyncAt: s.lastRealSyncAt,
        destinations: s.destinations ?? DEFAULT_DESTINATIONS,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SwarmState>;
        return {
          ...current,
          ...p,
          destinations: {
            ...DEFAULT_DESTINATIONS,
            ...p.destinations,
            redditUser: p.destinations?.redditUser || DEFAULT_DESTINATIONS.redditUser,
            xHandle: p.destinations?.xHandle || DEFAULT_DESTINATIONS.xHandle,
          },
        };
      },
    },
  ),
);
