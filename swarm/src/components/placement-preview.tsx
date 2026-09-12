import { ExternalLink } from "lucide-react";
import { productBySku, productImageSrc } from "@/lib/catalog";
import type { Organism } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PlacementPreview({ organism }: { organism: Organism }) {
  const product = productBySku(organism.sku);
  if (organism.channel === "search") return <SearchAd organism={organism} skuName={product?.name} />;
  if (organism.channel === "conversation") return <ConversationAd organism={organism} />;
  if (organism.channel === "proof") return <ProofAd organism={organism} skuName={product?.name} price={product?.price} />;
  return <ShadowAd organism={organism} skuName={product?.name} />;
}

function SearchAd({ organism, skuName }: { organism: Organism; skuName?: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-elevated p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <Badge>Search intercept</Badge>
        <span>Sponsored</span>
      </div>
      <a
        href={organism.landingUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block font-medium text-accent hover:underline"
      >
        {organism.headline}
      </a>
      <p className="mt-0.5 min-w-0 truncate font-mono text-[11px] text-success">
        {organism.landingUrl.replace(/^https?:\/\//, "")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{organism.body}</p>
      <p className="mt-3 text-xs text-subtle">{skuName}</p>
    </div>
  );
}

function ConversationAd({ organism }: { organism: Organism }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-elevated p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between">
        <Badge>Conversation native</Badge>
        <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">X / Reddit</span>
      </div>
      <div className="mt-4 flex gap-3">
        <img
          src={productImageSrc(organism.sku)}
          alt=""
          className="size-9 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">operator · just now</p>
          <p className="mt-2 text-sm leading-relaxed">
            {organism.headline}. {organism.body}
          </p>
          <a
            href={organism.landingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            {organism.cta} <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function ProofAd({
  organism,
  skuName,
  price,
}: {
  organism: Organism;
  skuName?: string;
  price?: number;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-elevated shadow-[var(--shadow-border)]">
      <img
        src={productImageSrc(organism.sku)}
        alt={skuName ?? organism.sku}
        className="aspect-[3/2] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
      />
      <div className="p-5">
      <div className="flex items-center justify-between">
        <Badge variant="accent">Proof-loop</Badge>
        <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
          The spec is the ad
        </span>
      </div>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-accent">{organism.headline}</p>
      <h3 className="mt-2 text-xl font-medium tracking-tight">{skuName}</h3>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4 border-b border-border py-2">
          <dt className="shrink-0 text-muted">Proof</dt>
          <dd className="min-w-0 text-right break-words">{organism.proofHook}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border py-2">
          <dt className="shrink-0 text-muted">Job</dt>
          <dd className="min-w-0 max-w-[70%] text-right break-words">{organism.body}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">Cost</dt>
          <dd className="font-mono tabular-nums">${price} one-time</dd>
        </div>
      </dl>
      <Button asChild className="mt-4 w-full">
        <a href={organism.landingUrl} target="_blank" rel="noreferrer">
          {organism.cta}
        </a>
      </Button>
      </div>
    </div>
  );
}

function ShadowAd({ organism, skuName }: { organism: Organism; skuName?: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-elevated p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between">
        <Badge>Shadow listing</Badge>
        <span className="text-[11px] text-subtle">r/productivity · 2h</span>
      </div>
      <p className="mt-3 text-sm font-medium">What actually works for this — not another wrapper</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {organism.body} {skuName ? `(${skuName})` : null}
      </p>
      <a
        href={organism.landingUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex text-xs text-accent hover:underline"
      >
        {organism.cta} →
      </a>
    </div>
  );
}
