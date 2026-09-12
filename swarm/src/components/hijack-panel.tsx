import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { generateSwarmCopy } from "@/lib/ai";
import { productBySku } from "@/lib/catalog";
import { useSwarmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function HijackPanel({
  sku,
  intent,
  compact,
}: {
  sku: string;
  intent: string;
  compact?: boolean;
}) {
  const [ai, setAi] = useState(true);
  const [busy, setBusy] = useState(false);
  const hijack = useSwarmStore((s) => s.hijack);
  const navigate = useNavigate();
  const product = productBySku(sku);

  async function run() {
    if (!product) return;
    setBusy(true);
    try {
      let copies;
      if (ai) {
        const res = await generateSwarmCopy({
          data: {
            productName: product.name,
            sku: product.sku,
            price: product.price,
            job: product.job,
            proof: product.proof,
            pain: product.pain,
            format: product.format,
            intent,
          },
        });
        if (res.ok) copies = res.copies;
        else toast.message(res.error, { description: "Spawning with the local genome instead." });
      }
      hijack({ sku, intent, copies });
      toast.success("Swarm spawned", { description: "Eight organisms across four channels." });
      void navigate({ to: "/swarm" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-3" : "flex flex-col gap-4"}>
      {!compact ? (
        <p className="text-sm text-muted">
          Hijack this utterance with a proof-first swarm aimed at {product?.name}. Organisms
          spawn on search, conversation, proof-loop, and shadow listings.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`ai-${sku}`}>Write copy with Grok</Label>
        <Switch id={`ai-${sku}`} checked={ai} onCheckedChange={setAi} />
      </div>
      <Button onClick={() => void run()} disabled={busy || !intent}>
        {busy ? "Spawning…" : "Hijack this intent"}
      </Button>
    </div>
  );
}
