import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Monitor, Smartphone } from "lucide-react";
import {
  getDeferredPrompt,
  installApp,
  isInAppBrowser,
  isStandalone,
  platformOf,
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
  const [busy, setBusy] = useState(false);
  const platform = platformOf();
  const iab = typeof window !== "undefined" && isInAppBrowser();

  useEffect(() => {
    setInstalled(isStandalone());
    setCanPrompt(Boolean(getDeferredPrompt()));
    return subscribeInstall(() => {
      setCanPrompt(Boolean(getDeferredPrompt()));
      setInstalled(isStandalone());
    });
  }, []);

  async function install() {
    if (installed) return;
    setBusy(true);
    try {
      const result = await installApp();
      if (result === "accepted") {
        toast.success("SWARM is on this phone");
        setInstalled(true);
        return;
      }
      if (result === "opened-chrome") {
        toast.message("Opening Chrome to install", {
          description: "Tap Download once. Chrome installs it in that window — no Play Store.",
        });
        return;
      }
      if (result === "ios") {
        toast.message("On iPhone: Share → Add to Home Screen");
        return;
      }
      if (result === "dismissed") return;
      toast.message("Tap Download again", {
        description: "Chrome is preparing the install sheet. One more tap installs in this window.",
      });
    } finally {
      setBusy(false);
    }
  }

  const label = installed
    ? "Already installed"
    : busy
      ? "Installing…"
      : canPrompt
        ? "Download SWARM"
        : iab || platform === "android"
          ? "Download SWARM"
          : "Download SWARM";

  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <Badge variant="accent">Android app</Badge>
        <h1 className="mt-4 text-4xl font-medium tracking-tight">Download SWARM to this phone</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          One tap. In Chrome it installs in this window — home screen, app drawer, no Play Store. In
          X or Grok it opens Chrome and installs there.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => void install()} disabled={installed || busy}>
            <Download className="size-4" />
            {label}
          </Button>
          <Button asChild variant="outline">
            <a href="https://multinicheai.com/swarm?install=1" rel="noreferrer">
              Open on multinicheai.com
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-accent" />
              <h2 className="text-lg font-medium">In Chrome</h2>
            </div>
            <p className="mt-3 text-sm text-muted">
              Tap Download. Chrome shows the install sheet in this window. That is the app — not a
              bookmark.
            </p>
            {platform === "android" && !iab ? (
              <p className="mt-4 text-xs text-accent">This looks like Chrome on Android.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-accent" />
              <h2 className="text-lg font-medium">In X or Grok</h2>
            </div>
            <p className="mt-3 text-sm text-muted">
              Those windows cannot install apps. Download opens Chrome with the same page, then the
              install sheet. One extra tap, still no Play Store.
            </p>
            {iab ? <p className="mt-4 text-xs text-warn">You are in an in-app browser.</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <h2 className="text-lg font-medium">X and Reddit destinations</h2>
          <p className="mt-2 text-sm text-muted">
            Go live opens compose on the account already signed in on this phone. X is
            @DupreJesse14633. Reddit is u/MultiNicheAI81.
          </p>
          <div className="mt-5">
            <DestinationsConfig />
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-subtle">
        Live operator stays up at{" "}
        <a href="https://multinicheai.com/swarm" className="text-muted underline-offset-4 hover:underline">
          multinicheai.com/swarm
        </a>
        .{" "}
        <Link to="/product" className="text-muted underline-offset-4 hover:underline">
          Site listing kit
        </Link>
        .
      </p>
    </div>
  );
}
