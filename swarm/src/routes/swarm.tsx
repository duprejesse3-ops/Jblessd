import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Pause, Play, FastForward } from "lucide-react";
import { packetMarkdown } from "@/lib/genome";
import { hoursLabel, totals } from "@/lib/stats";
import { useSwarmStore } from "@/lib/store";
import { formatCompact, formatMoney } from "@/lib/utils";
import { OrganismCard, channelLabel } from "@/components/organism-card";
import { PlacementPreview } from "@/components/placement-preview";
import { GoLivePanel } from "@/components/go-live-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/swarm")({ component: SwarmBoard });

function SwarmBoard() {
  const swarms = useSwarmStore((s) => s.swarms);
  const organisms = useSwarmStore((s) => s.organisms);
  const selectedId = useSwarmStore((s) => s.selectedId);
  const select = useSwarmStore((s) => s.select);
  const toggleRun = useSwarmStore((s) => s.toggleRun);
  const tick = useSwarmStore((s) => s.tick);
  const setBudget = useSwarmStore((s) => s.setBudget);
  const [swarmId, setSwarmId] = useState(swarms[0]?.id ?? "");
  const [showKilled, setShowKilled] = useState(false);
  const swarm = swarms.find((s) => s.id === swarmId) ?? swarms[0];
  const list = useMemo(
    () =>
      organisms
        .filter((o) => !swarm || o.swarmId === swarm.id)
        .sort((a, b) => {
          const rank = (s: string) => (s === "live" ? 0 : s === "champion" ? 1 : s === "alive" ? 2 : 3);
          const d = rank(a.status) - rank(b.status);
          if (d !== 0) return d;
          return b.fitness - a.fitness;
        }),
    [organisms, swarm],
  );
  const live = useMemo(() => list.filter((o) => o.status !== "killed"), [list]);
  const shipped = useMemo(() => list.filter((o) => o.status === "live"), [list]);
  const dead = useMemo(() => list.filter((o) => o.status === "killed"), [list]);
  const selected =
    organisms.find((o) => o.id === selectedId) ?? live[0] ?? list[0];
  const stats = totals(list);

  async function copyPacket() {
    const md = packetMarkdown(list);
    await navigator.clipboard.writeText(md);
    toast.success("Deploy packet copied");
  }

  if (!swarm) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">No swarms yet. Hijack an intent from Radar.</p>
        <Button asChild className="mt-4">
          <Link to="/">Open radar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Organism board</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">{swarm.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Generation {swarm.generation} · {hoursLabel(swarm.simulatedHours)}
          </p>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Tap <span className="text-fg">Post on X</span> or{" "}
            <span className="text-fg">Post Reddit</span> on a card. Compose opens with the ad
            filled. You hit Post in that app. SWARM does not bill you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toggleRun(swarm.id)}>
            {swarm.running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {swarm.running ? "Pause" : "Run"}
          </Button>
          <Button variant="secondary" onClick={() => tick(24)}>
            <FastForward className="size-4" /> 24h
          </Button>
          <Button variant="outline" onClick={() => void copyPacket()}>
            <Copy className="size-4" /> Packet
          </Button>
        </div>
      </div>

      {swarms.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 min-w-0">
          {swarms.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSwarmId(s.id)}
              className="shrink-0 rounded-full px-3 py-2 text-xs shadow-[var(--shadow-border)]"
            >
              <span className={s.id === swarm.id ? "text-fg" : "text-muted"}>{s.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini label="Impressions (lab)" value={formatCompact(stats.impressions)} />
        <Mini label="Hijacked clicks (lab)" value={formatCompact(stats.clicks)} />
        <Mini label="Conversions (lab)" value={String(stats.conversions)} />
        <Mini label="Spend (lab)" value={formatMoney(stats.spend)} />
      </div>

      <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-subtle">
        Daily mycelium budget · {formatMoney(swarm.dailyBudget)}
        <input
          type="range"
          min={12}
          max={240}
          step={4}
          value={swarm.dailyBudget}
          onChange={(e) => setBudget(swarm.id, Number(e.target.value))}
          className="h-11 accent-accent"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">{live.length} in lab</Badge>
        {shipped.length ? <Badge variant="success">{shipped.length} live</Badge> : null}
        <Badge variant={dead.length ? "danger" : "default"}>{dead.length} killed</Badge>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_0.95fr]">
        <div className="flex min-w-0 flex-col gap-3">
          {live.length === 0 ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted">
                  No organisms in this swarm. Autopilot will hijack a fresh intent from Radar.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/">Open radar</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            live.map((o) => (
              <OrganismCard
                key={o.id}
                organism={o}
                selected={selected?.id === o.id}
                onSelect={() => select(o.id)}
              />
            ))
          )}
          {dead.length > 0 ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowKilled((v) => !v)}
                className="flex min-h-11 w-full items-center justify-between rounded-xl bg-surface px-4 text-left text-sm shadow-[var(--shadow-border)]"
              >
                <span className="text-muted">
                  {showKilled ? "Hide killed losers" : `Show ${dead.length} killed losers`}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
                  {showKilled ? "Open" : "Closed"}
                </span>
              </button>
              {showKilled
                ? dead.map((o) => (
                    <div key={o.id} className="mt-3">
                      <OrganismCard
                        organism={o}
                        selected={selected?.id === o.id}
                        onSelect={() => select(o.id)}
                      />
                    </div>
                  ))
                : null}
            </div>
          ) : null}
        </div>
        {selected ? (
          <div className="h-fit min-w-0 lg:sticky lg:top-20">
            <div className="mb-3 flex items-center justify-between">
              <Badge>{channelLabel(selected.channel)}</Badge>
              <Button asChild variant="ghost" size="sm">
                <Link to="/studio">Open in studio</Link>
              </Button>
            </div>
            <PlacementPreview organism={selected} />
            <div className="mt-4">
              <GoLivePanel organism={selected} />
            </div>
            <Card className="mt-4">
              <CardContent className="pt-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Genome</p>
                <p className="mt-2 text-sm">{selected.targetIntent}</p>
                <p className="mt-2 text-xs text-muted">{selected.proofHook}</p>
                <a
                  href={selected.landingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block min-w-0 truncate font-mono text-[11px] text-accent hover:underline"
                >
                  {selected.landingUrl}
                </a>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-[11px] uppercase tracking-widest text-subtle">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums">{value}</p>
    </div>
  );
}