import { productBySku } from "@/lib/catalog";
import { replyIntentUrl } from "@/lib/deploy";
import type { IntentPulse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SOURCE_LABEL = {
  search: "Search",
  x: "X",
  reddit: "Reddit",
  forum: "Forum",
} as const;

export function RadarScope({
  pulses,
  selectedId,
  onSelect,
}: {
  pulses: IntentPulse[];
  selectedId?: string | null;
  onSelect: (pulse: IntentPulse) => void;
}) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      <svg viewBox="0 0 100 100" className="size-full overflow-visible">
        <defs>
          <radialGradient id="scopeFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(168 212 176 / 0.08)" />
            <stop offset="100%" stopColor="rgb(168 212 176 / 0)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="url(#scopeFill)" />
        {[14, 26, 38, 46].map((r) => (
          <circle
            key={r}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="rgb(168 212 176 / 0.22)"
            strokeWidth="0.3"
          />
        ))}
        <line x1="50" y1="4" x2="50" y2="96" stroke="rgb(168 212 176 / 0.16)" strokeWidth="0.3" />
        <line x1="4" y1="50" x2="96" y2="50" stroke="rgb(168 212 176 / 0.16)" strokeWidth="0.3" />
        <g className="origin-center" style={{ transformOrigin: "50px 50px", animation: "sweep 9s linear infinite" }}>
          <path d="M50 50 L50 4 A46 46 0 0 1 72 8 Z" fill="rgb(168 212 176 / 0.08)" />
        </g>
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="rgb(168 212 176 / 0.18)"
          strokeWidth="0.4"
          className="origin-center"
          style={{ transformOrigin: "50px 50px", animation: "radar-ring 3.4s ease-out infinite" }}
        />
        {pulses.slice(0, 18).map((p) => {
          const rad = ((p.angle - 90) * Math.PI) / 180;
          const r = 12 + (p.radius / 100) * 32;
          const x = Number((50 + Math.cos(rad) * r).toFixed(2));
          const y = Number((50 + Math.sin(rad) * r).toFixed(2));
          const on = selectedId === p.id;
          const size = Number((0.9 + p.heat / 140).toFixed(2));
          return (
            <g
              key={p.id}
              className="cursor-pointer"
              onClick={() => onSelect(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(p);
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={size + 1.6}
                fill="none"
                stroke={on ? "rgb(168 212 176 / 0.7)" : "rgb(168 212 176 / 0.15)"}
                strokeWidth="0.35"
              />
              <circle
                cx={x}
                cy={y}
                r={size}
                fill="var(--color-accent)"
                opacity={on ? 1 : 0.85}
                style={{ animation: "pulse-dot 2.4s ease-in-out infinite" }}
              />
            </g>
          );
        })}
        <circle cx="50" cy="50" r="1.2" fill="var(--color-accent)" />
      </svg>
    </div>
  );
}

export function PulseList({
  pulses,
  selectedId,
  onSelect,
}: {
  pulses: IntentPulse[];
  selectedId?: string | null;
  onSelect: (pulse: IntentPulse) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {pulses.slice(0, 8).map((p) => {
        const product = productBySku(p.sku);
        const on = selectedId === p.id;
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p)}
              className={cn(
                "w-full rounded-lg p-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-150",
                on ? "bg-elevated shadow-[var(--shadow-border-hover)]" : "bg-surface hover:bg-elevated",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
                  {p.live ? "Live X" : SOURCE_LABEL[p.source]} · {p.sku}
                  {p.handle ? ` · @${p.handle}` : ""}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-accent">{p.heat}</span>
              </div>
              <p className="mt-1 text-sm leading-snug">{p.text}</p>
              <p className="mt-1 text-xs text-muted">{product?.name}</p>
            </button>
            {p.live && p.postUrl ? (
              <div className="mt-2">
                <Button
                  size="sm"
                  className="min-h-11 w-full"
                  onClick={() => {
                    window.open(
                      replyIntentUrl({ postUrl: p.postUrl, sku: p.sku }),
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  Reply on X
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
