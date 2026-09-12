import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Radio, Settings2, Share2, Undo2 } from "lucide-react";
import {
  channelVerb,
  copyOrganismPacket,
  deployTargets,
  destOf,
  shareOrganism,
} from "@/lib/deploy";
import { useSwarmStore } from "@/lib/store";
import type { DeployTarget } from "@/lib/deploy";
import type { Organism } from "@/lib/types";
import { DestinationsConfig } from "@/components/destinations-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function GoLivePanel({ organism }: { organism: Organism }) {
  const goLive = useSwarmStore((s) => s.goLive);
  const pullFromLive = useSwarmStore((s) => s.pullFromLive);
  const destinations = useSwarmStore((s) => s.destinations);
  const dest = destOf(destinations);
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const targets = deployTargets(organism, dest);
  const primary = targets[0]!;
  const isLive = organism.status === "live";

  async function ship(target: DeployTarget) {
    const copied = await copyOrganismPacket(organism);
    if (copied) {
      toast.success("Packet copied", { description: target.label });
    }
    window.open(target.href, "_blank", "noopener,noreferrer");
    goLive(organism.id);
    setOpen(false);
  }

  async function share() {
    const result = await shareOrganism(organism);
    if (result === "shared") {
      goLive(organism.id);
      toast.success("Shared — marked live");
      return;
    }
    if (result === "copied") {
      toast.success("Copied. Paste into X, Reddit, or the app you post from.");
      goLive(organism.id);
      return;
    }
    toast.message("Could not share", { description: "Copy the packet from Studio instead." });
  }

  if (isLive) {
    return (
      <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[10px] uppercase tracking-widest text-success">Live — not a sim</p>
        <p className="mt-2 text-sm text-muted">
          Lab is frozen on this card. Real clicks come through the UTM link. SWARM still does not
          bill you.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {targets.map((t) => (
            <Button key={t.id} asChild variant={t.id === primary.id ? "default" : "outline"}>
              <a href={t.href} target="_blank" rel="noreferrer">
                {t.label}
                <ExternalLink className="size-4" />
              </a>
            </Button>
          ))}
          <Button variant="outline" onClick={() => pullFromLive(organism.id)}>
            <Undo2 className="size-4" />
            Back to lab
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Make it real</p>
        <p className="mt-2 text-sm text-muted">
          Lab numbers are simulated. Go live copies the ad and opens X, Reddit, Google Ads, or the
          site. @{dest.xHandle} / r/{dest.redditSub}. SWARM does not charge you.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}>
            <Radio className="size-4" />
            {channelVerb(organism.channel)}
          </Button>
          <Button variant="outline" onClick={() => void share()}>
            <Share2 className="size-4" />
            Share from phone
          </Button>
          <Button variant="ghost" onClick={() => setConfigOpen(true)}>
            <Settings2 className="size-4" />
            Destinations
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Go live — {channelVerb(organism.channel)}</DialogTitle>
            <DialogDescription>
              Copy is on the clipboard. Pick X, Reddit, or both. You post as the account already
              logged in on this phone.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted">{organism.headline}</p>
          <p className="mt-2 min-w-0 truncate font-mono text-[11px] text-subtle">
            {organism.landingUrl}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {targets.map((t) => (
              <Button key={t.id} variant={t.id === primary.id ? "default" : "secondary"} onClick={() => void ship(t)}>
                {t.label}
              </Button>
            ))}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Stay in lab
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Destinations</DialogTitle>
            <DialogDescription>
              X is @{dest.xHandle}. Add Reddit so shadow listings and conversation intercepts open
              the right community.
            </DialogDescription>
          </DialogHeader>
          <DestinationsConfig compact />
        </DialogContent>
      </Dialog>
    </>
  );
}
