import type { MouseEvent } from "react";
import { toast } from "sonner";
import { CHANNELS } from "@/lib/genome";
import { productBySku, productImageSrc } from "@/lib/catalog";
import { copyOrganismPacket, deployTargets, destOf, type DeployTarget } from "@/lib/deploy";
import { useSwarmStore } from "@/lib/store";
import type { Organism } from "@/lib/types";
import { cn, formatCompact, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function channelLabel(channel: Organism["channel"]) {
  return CHANNELS.find((c) => c.id === channel)?.label ?? channel;
}

export function OrganismCard({
  organism,
  selected,
  onSelect,
}: {
  organism: Organism;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const product = productBySku(organism.sku);
  const goLive = useSwarmStore((s) => s.goLive);
  const destinations = useSwarmStore((s) => s.destinations);
  const dest = destOf(destinations);
  const dead = organism.status === "killed";
  const shipped = organism.status === "live";
  const targets = dead ? [] : deployTargets(organism, dest).slice(0, 2);

  async function post(target: DeployTarget, event: MouseEvent) {
    event.stopPropagation();
    onSelect?.();
    const copied = await copyOrganismPacket(organism);
    if (copied) toast.success("Copied — now tap Post in the app that opens");
    window.open(target.href, "_blank", "noopener,noreferrer");
    goLive(organism.id);
  }

  return (
    <article
      className={cn(
        "w-full max-w-full overflow-hidden rounded-xl text-left shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-150",
        selected ? "bg-elevated shadow-[var(--shadow-border-hover)]" : "bg-surface",
        dead && "opacity-50",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        {product ? (
          <img
            src={productImageSrc(product.sku)}
            alt={product.name}
            className="aspect-[3/2] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
          />
        ) : null}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    shipped
                      ? "success"
                      : organism.status === "champion"
                        ? "accent"
                        : dead
                          ? "danger"
                          : "default"
                  }
                >
                  {shipped ? "live" : organism.status}
                </Badge>
                <span className="min-w-0 font-mono text-[10px] uppercase tracking-widest text-subtle">
                  {channelLabel(organism.channel)} · gen {organism.generation}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-medium leading-snug break-words">{organism.headline}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted break-words">{organism.body}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-lg tabular-nums text-accent">{organism.fitness.toFixed(0)}</div>
              <div className="text-[10px] uppercase tracking-widest text-subtle">fitness</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-[11px] tabular-nums text-muted">
            {shipped ? (
              <span className="col-span-4 text-success">Shipped · tap Post again to reshare</span>
            ) : (
              <>
                <span>{formatCompact(organism.impressions)} imp</span>
                <span>{formatCompact(organism.clicks)} clk</span>
                <span>{organism.conversions} conv</span>
                <span>{formatMoney(organism.spend)}</span>
              </>
            )}
          </div>
          <p className="mt-2 min-w-0 truncate font-mono text-[10px] text-subtle">
            {product?.name} · {organism.sku}
          </p>
        </div>
      </button>
      {targets.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {targets.map((target, i) => (
            <Button
              key={target.id}
              size="sm"
              variant={i === 0 ? "default" : "secondary"}
              className="min-h-11 flex-1"
              onClick={(e) => void post(target, e)}
            >
              {target.label}
            </Button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
