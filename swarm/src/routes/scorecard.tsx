import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SITE, productBySku } from "@/lib/catalog";
import { channelLabel } from "@/components/organism-card";
import type { Channel } from "@/lib/types";
import { formatCompact, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/scorecard")({ component: ScorecardPage });

interface ScorecardRow {
  orgId: string;
  swarmId: string;
  sku: string;
  channel: string;
  headline: string;
  body: string;
  proofHook: string | null;
  landingUrl: string;
  liveAt: string;
  landings: number;
  purchases: number;
  revenue: number;
}

interface ScorecardReport {
  windowDays: number;
  asOf: string;
  totals: { landings: number; purchases: number; revenue: number; conversionRate: number };
  organisms: ScorecardRow[];
}

// This route deliberately does NOT read useSwarmStore — SWARM's lab state is
// browser-local (see swarm/README.md), so a stranger's browser has none of
// it. Everything here comes straight from /api/swarm-scorecard, the one
// dataset that's actually shared: real copy (swarm_organisms, written by
// goLive()) joined against real landings/purchases (ad_events).
function ScorecardPage() {
  const [report, setReport] = useState<ScorecardReport | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${SITE}/api/swarm-scorecard?days=30`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <Badge variant="accent">Real data · last 30 days</Badge>
        <h1 className="mt-4 text-4xl font-medium tracking-tight">SWARM scorecard</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Every organism SWARM has actually shipped — not the simulated lab preview. Real landings
          and real purchases, from the same first-party dataset that drives multinicheai.com's own
          ad reporting. Nothing hidden: an organism with zero clicks shows zero clicks.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted">
            Could not reach the scorecard data. Try again shortly.
          </CardContent>
        </Card>
      ) : !report ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted">Loading real performance…</CardContent>
        </Card>
      ) : report.organisms.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted">
            Nothing shipped yet in this window. Go live on an organism and it appears here — with
            whatever it actually does, good or bad.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="organisms live" value={String(report.organisms.length)} />
            <Stat label="real landings" value={formatCompact(report.totals.landings)} />
            <Stat label="real purchases" value={String(report.totals.purchases)} />
            <Stat label="conversion rate" value={`${(report.totals.conversionRate * 100).toFixed(1)}%`} />
          </div>

          <div className="flex flex-col gap-3">
            {report.organisms.map((o) => (
              <ScorecardCard key={o.orgId} row={o} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="font-mono text-2xl tabular-nums text-accent">{value}</div>
        <div className="mt-1 text-[11px] uppercase tracking-widest text-subtle">{label}</div>
      </CardContent>
    </Card>
  );
}

function ScorecardCard({ row }: { row: ScorecardRow }) {
  const product = productBySku(row.sku);
  const proven = row.landings > 0;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={proven ? "success" : "default"}>{proven ? "proven" : "posted"}</Badge>
              <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
                {channelLabel(row.channel as Channel)} · {product?.name ?? row.sku}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-medium leading-snug break-words">{row.headline}</h3>
            <p className="mt-1 text-xs text-muted break-words">{row.body}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums text-muted">
          <span>{formatCompact(row.landings)} landings</span>
          <span>{row.purchases} purchases</span>
          <span>{formatMoney(row.revenue)}</span>
        </div>
        <a
          href={row.landingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block truncate font-mono text-[10px] text-subtle hover:text-accent"
        >
          {row.landingUrl}
        </a>
      </CardContent>
    </Card>
  );
}
