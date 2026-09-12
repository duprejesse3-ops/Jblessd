import { useEffect, useState } from "react";
import { DEFAULT_DESTINATIONS, REDDIT_SUBS, destOf, redditUserUrl, xProfileUrl } from "@/lib/deploy";
import { useSwarmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DestinationsConfig({ compact }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const raw = useSwarmStore((s) => s.destinations);
  const setDestinations = useSwarmStore((s) => s.setDestinations);
  const dest = destOf(raw);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-40 rounded-xl bg-elevated" aria-hidden />;
  }

  return (
    <div className="flex flex-col gap-4">
      {!compact ? (
        <p className="text-sm text-muted">
          SWARM opens compose on the account you are logged into. These names label the packet and
          pick the Reddit community. Not a login. Not a charge.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="x-handle">X handle</Label>
          <Input
            id="x-handle"
            value={dest.xHandle}
            autoComplete="username"
            placeholder="DupreJesse14633"
            onChange={(e) => setDestinations({ xHandle: e.target.value })}
          />
          <a
            href={xProfileUrl(dest)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-accent hover:underline"
          >
            x.com/{dest.xHandle || "…"}
          </a>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reddit-user">Reddit username</Label>
          <Input
            id="reddit-user"
            value={dest.redditUser}
            autoComplete="username"
            placeholder="MultiNicheAI81"
            onChange={(e) => setDestinations({ redditUser: e.target.value })}
          />
          {dest.redditUser ? (
            <a
              href={redditUserUrl(dest)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-accent hover:underline"
            >
              u/{dest.redditUser}
            </a>
          ) : (
            <p className="font-mono text-[11px] text-subtle">optional — signs the listing</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reddit-sub">Reddit community</Label>
        <Input
          id="reddit-sub"
          value={dest.redditSub}
          placeholder="smallbusiness"
          onChange={(e) => setDestinations({ redditSub: e.target.value })}
        />
        <div className="flex flex-wrap gap-2">
          {REDDIT_SUBS.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setDestinations({ redditSub: sub })}
              className={
                dest.redditSub.toLowerCase() === sub.toLowerCase()
                  ? "h-11 rounded-full bg-accent px-3 text-xs text-accent-fg"
                  : "h-11 rounded-full bg-elevated px-3 text-xs text-muted shadow-[var(--shadow-border)]"
              }
            >
              r/{sub}
            </button>
          ))}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setDestinations(DEFAULT_DESTINATIONS)}
      >
        Reset to @DupreJesse14633 / u/MultiNicheAI81
      </Button>
    </div>
  );
}
