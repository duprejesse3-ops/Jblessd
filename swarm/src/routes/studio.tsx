import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { CHANNELS } from "@/lib/genome";
import { useSwarmStore } from "@/lib/store";
import { OrganismCard } from "@/components/organism-card";
import { PlacementPreview } from "@/components/placement-preview";
import { GoLivePanel } from "@/components/go-live-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/studio")({ component: Studio });

function Studio() {
  const organismsAll = useSwarmStore((s) => s.organisms);
  const selectedId = useSwarmStore((s) => s.selectedId);
  const select = useSwarmStore((s) => s.select);
  const [channel, setChannel] = useState<string>("all");
  const organisms = useMemo(
    () => organismsAll.filter((o) => o.status !== "killed"),
    [organismsAll],
  );
  const list = useMemo(
    () => organisms.filter((o) => channel === "all" || o.channel === channel),
    [organisms, channel],
  );
  const selected = organisms.find((o) => o.id === selectedId) ?? list[0];

  async function copySelected() {
    if (!selected) return;
    const text = [
      selected.headline,
      selected.body,
      selected.proofHook,
      selected.cta,
      selected.landingUrl,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Ad copy copied");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Placement studio</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">See the ad as the channel will</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Proof-loop is the format that does not exist in the ad networks. Go live ships the packet
          to Google, X, or the site. Lab numbers stay simulated until you do.
        </p>
      </div>

      <Tabs value={channel} onValueChange={setChannel}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          {CHANNELS.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-auto pr-1">
          {list.map((o) => (
            <OrganismCard
              key={o.id}
              organism={o}
              selected={selected?.id === o.id}
              onSelect={() => select(o.id)}
            />
          ))}
        </div>
        {selected ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Native preview</h2>
              <Button variant="outline" size="sm" onClick={() => void copySelected()}>
                <Copy className="size-4" /> Copy
              </Button>
            </div>
            <PlacementPreview organism={selected} />
            <GoLivePanel organism={selected} />
            <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
              <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">
                Why this placement
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {CHANNELS.find((c) => c.id === selected.channel)?.native}. Genome target: “
                {selected.targetIntent}”. If it cannot answer that sentence with a proof, it dies
                in evolve.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Spawn a swarm from Radar to preview placements.</p>
        )}
      </div>
    </div>
  );
}
