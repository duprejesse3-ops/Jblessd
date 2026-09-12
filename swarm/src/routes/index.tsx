import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ArrowRight, Eye, Radio, Target } from "lucide-react";
import { scanLiveIntents } from "@/lib/ai";
import { productBySku } from "@/lib/catalog";
import { CHANNELS } from "@/lib/genome";
import { droughtSeries, hoursLabel, totals } from "@/lib/stats";
import { useSwarmStore } from "@/lib/store";
import { formatCompact, formatMoney } from "@/lib/utils";
import { HijackPanel } from "@/components/hijack-panel";
import { PulseList, RadarScope } from "@/components/radar-scope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: RadarHome });

function RadarHome() {
  const pulses = useSwarmStore((s) => s.pulses);
  const organisms = useSwarmStore((s) => s.organisms);
  const swarms = useSwarmStore((s) => s.swarms);
  const autopilot = useSwarmStore((s) => s.autopilot);
  const activities = useSwarmStore((s) => s.activities);
  const ingestLive = useSwarmStore((s) => s.ingestLive);
  const lastLiveScanAt = useSwarmStore((s) => s.lastLiveScanAt);
  const [selectedId, setSelectedId] = useState<string | null>(pulses[0]?.id ?? null);
  const [scanning, setScanning] = useState(false);
  const liveCount = pulses.filter((p) => p.live).length;
  const selected = pulses.find((p) => p.id === selectedId) ?? pulses[0];
  const stats = totals(organisms);
  const series = useMemo(() => droughtSeries(), []);
  const product = selected ? productBySku(selected.sku) : undefined;

  async function scanLive() {
    setScanning(true);
    try {
      const res = await scanLiveIntents();
      if (!res.ok) {
        toast.message(res.error, { description: "Radar is still the lab until a scan lands." });
        return;
      }
      const first = ingestLive(res.hits);
      if (first) setSelectedId(first);
      toast.success(`${res.hits.length} live posts`, {
        description: "Reply on X is a real reply into that thread.",
      });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rise-in grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <Badge variant="accent">New ad method</Badge>
          <h1 className="mt-4 max-w-xl text-4xl font-medium tracking-tight md:text-5xl">
            Stop buying traffic. Hijack the intent that already exists.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Lab numbers are simulated. Real movement is a reply into a live post. Scan X, map the
            sentence to a SKU, tap Reply. That is an actual intercept — not a mock impression.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => void scanLive()} disabled={scanning}>
              {scanning ? "Scanning X…" : liveCount ? `Rescan live X · ${liveCount}` : "Scan live X"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/swarm">
                Open the swarm <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/install">Get the app</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/product">List on the site</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Hijacked visits" value={formatCompact(stats.clicks)} hint="lab, not live" />
          <Stat label="Proof conversions" value={String(stats.conversions)} hint="lab" />
          <Stat label="Live X posts" value={String(liveCount)} hint={lastLiveScanAt ? "from last scan" : "scan to fill"} />
          <Stat label="Spend" value={formatMoney(stats.spend)} hint="lab budget" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Intent radar</p>
                <h2 className="text-lg font-medium">
                  {liveCount ? "Live posts on X" : "Lab pain, until you scan"}
                </h2>
              </div>
              <Radio className="size-4 text-accent" />
            </div>
            <RadarScope
              pulses={pulses}
              selectedId={selected?.id}
              onSelect={(p) => setSelectedId(p.id)}
            />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <PulseList
            pulses={pulses}
            selectedId={selected?.id}
            onSelect={(p) => setSelectedId(p.id)}
          />
          {selected && product ? (
            <Card>
              <CardContent className="pt-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">
                  {product.sku} · {product.format}
                </p>
                <h3 className="mt-1 text-base font-medium">{product.name}</h3>
                <p className="mt-1 text-sm text-muted">{selected.text}</p>
                <div className="mt-4">
                  <HijackPanel sku={selected.sku} intent={selected.text} compact />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">The drought</p>
            <h2 className="mt-1 text-lg font-medium">Why interruption ads will not save the site</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Buying “AI tools” keywords is a tax paid to everyone louder than you. MultiNiche
              already has 60+ jobs-to-be-done. People type those jobs. SWARM answers the sentence
              they typed — with a receipt, not a slogan.
            </p>
            <div className="mt-5 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "var(--color-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--color-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RTooltip
                    contentStyle={{
                      background: "var(--color-elevated)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-fg)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="interrupt"
                    name="Interruption ads"
                    stroke="var(--color-muted)"
                    fill="var(--color-muted)"
                    fillOpacity={0.12}
                  />
                  <Area
                    type="monotone"
                    dataKey="hijack"
                    name="Intent hijack"
                    stroke="var(--color-accent)"
                    fill="var(--color-accent)"
                    fillOpacity={0.18}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] text-subtle">Modeled 14-day visits — not live Analytics.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">The method</p>
            <h2 className="mt-1 text-lg font-medium">Four native forms. One genome.</h2>
            <ul className="mt-4 space-y-3">
              {CHANNELS.map((ch) => (
                <li key={ch.id} className="flex gap-3 rounded-lg bg-elevated p-3">
                  <Target className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div>
                    <p className="text-sm font-medium">{ch.label}</p>
                    <p className="text-xs text-muted">{ch.native}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Proof-loop is the format that does not exist in Google Ads. The spec sheet is the
              creative. Fitness kills the rest. Generation N+1 is only descendants of winners.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/studio">
                Preview placements <Eye className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Autopilot log</h2>
          <Badge variant={autopilot ? "accent" : "default"}>
            {autopilot ? "Running" : "Paused"}
          </Badge>
        </div>
        <ul className="space-y-2">
          {activities.slice(0, 8).map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-lg bg-surface px-4 py-3 text-sm shadow-[var(--shadow-border)]"
            >
              <span>{a.text}</span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-subtle">
                {a.kind}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-[11px] uppercase tracking-widest text-subtle">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
