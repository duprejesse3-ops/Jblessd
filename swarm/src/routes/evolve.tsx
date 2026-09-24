import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { GitBranch, Skull, Sparkles } from "lucide-react";
import { evolveSwarmCopy } from "@/lib/ai";
import { productBySku } from "@/lib/catalog";
import { CHANNELS } from "@/lib/genome";
import { useSwarmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/evolve")({ component: EvolvePage });

function EvolvePage() {
  const swarms = useSwarmStore((s) => s.swarms);
  const organisms = useSwarmStore((s) => s.organisms);
  const evolve = useSwarmStore((s) => s.evolve);
  const resetLab = useSwarmStore((s) => s.resetLab);
  const [swarmId, setSwarmId] = useState(swarms[0]?.id ?? "");
  const [ai, setAi] = useState(true);
  const [busy, setBusy] = useState(false);
  const swarm = swarms.find((s) => s.id === swarmId) ?? swarms[0];
  const list = organisms.filter((o) => swarm && o.swarmId === swarm.id);
  const alive = list.filter((o) => o.status !== "killed").sort((a, b) => b.fitness - a.fitness);
  const killed = list.filter((o) => o.status === "killed");
  const gens = useMemo(() => {
    const max = Math.max(1, ...list.map((o) => o.generation));
    return Array.from({ length: max }, (_, i) => i + 1).map((g) => ({
      g,
      n: list.filter((o) => o.generation === g).length,
      best: Math.max(0, ...list.filter((o) => o.generation === g).map((o) => o.fitness)),
    }));
  }, [list]);

  async function runEvolve() {
    if (!swarm) return;
    setBusy(true);
    try {
      const winners = alive.slice(0, 4);
      const product = productBySku(winners[0]?.sku ?? "") ?? productBySku(list[0]?.sku ?? "");
      let copies;
      if (ai && product && winners.length) {
        const res = await evolveSwarmCopy({
          data: {
            intent: winners[0]!.targetIntent,
            productName: product.name,
            proof: product.proof,
            winners: winners.map((w) => ({
              channel: w.channel,
              headline: w.headline,
              body: w.body,
              proofHook: w.proofHook,
              cta: w.cta,
            })),
          },
        });
        if (res.ok) copies = res.copies;
        else toast.message(res.error, { description: "Breeding with the local genome." });
      }
      evolve(swarm.id, copies);
      toast.success(`Generation ${swarm.generation + 1}`, {
        description: "Bottom half killed. Winners mutated and crossed.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!swarm) {
    return <p className="py-16 text-center text-muted">No swarm to evolve yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Genetic desk</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">Kill, mutate, cross.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Generation N+1 is only descendants of winners. Fitness is CTR × conversion × proof-bias.
            Proof-loop organisms usually eat the rest — that is the method working.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="evo-ai">Grok rewrite</Label>
            <Switch id="evo-ai" checked={ai} onCheckedChange={setAi} />
          </div>
          <Button onClick={() => void runEvolve()} disabled={busy || alive.length < 2}>
            <Sparkles className="size-4" />
            {busy ? "Breeding…" : "Evolve generation"}
          </Button>
        </div>
      </div>

      {swarms.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {swarms.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSwarmId(s.id)}
              className="shrink-0 rounded-full px-3 py-2 text-xs text-muted shadow-[var(--shadow-border)]"
            >
              <span className={s.id === swarm.id ? "text-fg" : ""}>{s.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {gens.map((g) => (
          <Card key={g.g}>
            <CardContent className="pt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Gen {g.g}</p>
              <p className="mt-1 font-mono text-2xl tabular-nums">{g.n}</p>
              <p className="text-xs text-muted">best fitness {g.best.toFixed(0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <GitBranch className="size-4 text-accent" /> Winners
          </h2>
          <ul className="space-y-2">
            {alive.slice(0, 8).map((o, i) => (
              <li key={o.id} className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={i === 0 ? "accent" : "default"}>
                    {i === 0 ? "champion" : CHANNELS.find((c) => c.id === o.channel)?.label}
                  </Badge>
                  <span className="font-mono text-sm tabular-nums text-accent">{o.fitness.toFixed(0)}</span>
                </div>
                <p className="mt-2 text-sm">{o.headline}</p>
                {o.parentIds.length ? (
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    parents {o.parentIds.map((p) => p.replace(/^org_/, "")).join(" × ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Skull className="size-4 text-danger" /> Killed
          </h2>
          {killed.length === 0 ? (
            <p className="text-sm text-muted">No deaths yet. Evolve a generation to cull the bottom half.</p>
          ) : (
            <ul className="space-y-2">
              {killed.slice(0, 10).map((o) => (
                <li key={o.id} className="rounded-lg bg-surface p-3 opacity-60 shadow-[var(--shadow-border)]">
                  <p className="text-sm">{o.headline}</p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    gen {o.generation} · fitness {o.fitness.toFixed(0)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={() => resetLab()}>
        Reset the lab
      </Button>
    </div>
  );
}
