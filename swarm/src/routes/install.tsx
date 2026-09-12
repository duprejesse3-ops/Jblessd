import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Monitor, Smartphone } from "lucide-react";
import {
  getDeferredPrompt,
  isStandalone,
  platformOf,
  promptInstall,
  subscribeInstall,
} from "@/lib/install";
import { DestinationsConfig } from "@/components/destinations-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/install")({ component: InstallPage });

function InstallPage() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const platform = platformOf();

  useEffect(() => {
    setInstalled(isStandalone());
    setCanPrompt(Boolean(getDeferredPrompt()));
    return subscribeInstall(() => {
      setCanPrompt(Boolean(getDeferredPrompt()));
      setInstalled(isStandalone());
    });
  }, []);

  async function install() {
    const result = await promptInstall();
    if (result.ok && result.outcome === "accepted") {
      toast.success("SWARM installed");
      setInstalled(true);
      return;
    }
    toast.message("Use the steps for your device", {
      description: "Chrome and Edge will also show an install icon in the address bar.",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <Badge variant="accent">Android · Windows</Badge>
        <h1 className="mt-4 text-4xl font-medium tracking-tight">Install SWARM as an app</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          grok-sandbox.com is a preview tunnel. It sleeps (Cloudflare 521). SWARM itself is not
          down. For an app that stays up, host the GitHub repo on your own Vercel project, then
          install the PWA from that URL — not from a grok-sandbox bookmark.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => void install()} disabled={installed}>
            <Download className="size-4" />
            {installed ? "Already installed" : canPrompt ? "Install SWARM" : "Install when prompted"}
          </Button>
          <Button asChild variant="outline">
            <a href="https://github.com/duprejesse3-ops/swarm" target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link to="/product">Site listing kit</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <h2 className="text-lg font-medium">Your own host — stays up</h2>
          <p className="mt-2 text-sm text-muted">
            Source is already yours: github.com/duprejesse3-ops/swarm. Grok does not have to be
            running.
          </p>
          <ol className="mt-4 space-y-3 text-sm text-muted">
            <Step n="1" text="Open vercel.com, sign in with GitHub (duprejesse3-ops)." />
            <Step n="2" text="New Project → Import swarm. Deploy. You get a *.vercel.app URL that does not sleep." />
            <Step n="3" text="Optional: add swarm.multinicheai.com as the domain." />
            <Step n="4" text="Open that URL in Chrome. Tap Install SWARM. That home-screen app is standalone." />
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <a href="https://vercel.com/new/clone?repository-url=https://github.com/duprejesse3-ops/swarm" target="_blank" rel="noreferrer">
                Import on Vercel
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="https://github.com/duprejesse3-ops/swarm" target="_blank" rel="noreferrer">
                Open the repo
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-accent" />
              <h2 className="text-lg font-medium">Android</h2>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-muted">
              <Step n="1" text="Open this app in Chrome (not in-app browsers)." />
              <Step n="2" text="Tap Install SWARM above, or Chrome menu → Install app / Add to Home screen." />
              <Step n="3" text="Launch SWARM from the home screen. Autopilot is on by default." />
            </ol>
            {platform === "android" ? (
              <p className="mt-4 text-xs text-accent">This device looks like Android.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-accent" />
              <h2 className="text-lg font-medium">Windows</h2>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-muted">
              <Step n="1" text="Open in Edge or Chrome on Windows." />
              <Step n="2" text="Click Install SWARM, or the install icon in the address bar." />
              <Step n="3" text="Pin to Start or taskbar. Keyboard: 1–6 to move, A for autopilot, I for this page, 6 for the site listing kit." />
            </ol>
            {platform === "windows" ? (
              <p className="mt-4 text-xs text-accent">This device looks like Windows.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <h2 className="text-lg font-medium">X and Reddit destinations</h2>
          <p className="mt-2 text-sm text-muted">
            Go live opens compose on the account already signed in on this phone. X is
            @DupreJesse14633. Reddit is u/MultiNicheAI81. Pick the community listings should land
            in.
          </p>
          <div className="mt-5">
            <DestinationsConfig />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h2 className="text-lg font-medium">What “fully automatic” means</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Autopilot hijacks new intent pulses and spawns organisms — no click required.</li>
            <li>Running swarms tick on their own. Ripe swarms evolve. Losers die.</li>
            <li>Copy stays proof-first. Grok writes copy only when you ask it to, so autopilot cannot burn API quota.</li>
            <li>Go live copies the packet and opens X, Reddit, Google Ads, or the live spec.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated font-mono text-[11px]">
        {n}
      </span>
      <span className="pt-0.5">{text}</span>
    </li>
  );
}
