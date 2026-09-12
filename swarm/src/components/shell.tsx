import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Download, Dna, Ellipsis, Hexagon, Library, Package, Radar, LayoutTemplate, ShieldCheck } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useSwarmStore } from "@/lib/store";
import { BRAND, COPYRIGHT, SITE } from "@/lib/catalog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { armInstallCapture, isStandalone } from "@/lib/install";

const NAV = [
  { to: "/", label: "Radar", icon: Radar, key: "1" },
  { to: "/swarm", label: "Swarm", icon: Hexagon, key: "2" },
  { to: "/studio", label: "Studio", icon: LayoutTemplate, key: "3" },
  { to: "/evolve", label: "Evolve", icon: Dna, key: "4" },
  { to: "/catalog", label: "Catalog", icon: Library, key: "5" },
  { to: "/product", label: "Product", icon: Package, key: "6" },
  { to: "/scorecard", label: "Scorecard", icon: ShieldCheck, key: "7" },
] as const;

const PRIMARY = NAV.slice(0, 4);
const MORE = NAV.slice(4);

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const tick = useSwarmStore((s) => s.tick);
  const listen = useSwarmStore((s) => s.listen);
  const autoStep = useSwarmStore((s) => s.autoStep);
  const autopilot = useSwarmStore((s) => s.autopilot);
  const setAutopilot = useSwarmStore((s) => s.setAutopilot);
  const [standalone, setStandalone] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useSwarmStore.persist.rehydrate()).then(() => {
      if (cancelled) return;
      useSwarmStore.getState().setHydrated();
      if (useSwarmStore.getState().autopilot) {
        useSwarmStore.getState().autoStep();
      }
    });
    armInstallCapture();
    setStandalone(isStandalone());
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (useSwarmStore.getState().autopilot) {
        useSwarmStore.getState().autoStep();
      } else if (useSwarmStore.getState().swarms.some((sw) => sw.running)) {
        tick(1);
        listen();
      }
    }, 1800);
    return () => window.clearInterval(id);
  }, [autoStep, tick, listen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const hit = NAV.find((n) => n.key === e.key);
      if (hit) {
        e.preventDefault();
        void navigate({ to: hit.to });
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setAutopilot(!useSwarmStore.getState().autopilot);
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        void navigate({ to: "/install" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, setAutopilot]);

  const moreActive = MORE.some((n) => n.to === pathname) || pathname === "/install";

  return (
    <TooltipProvider>
      <div
        className={cn("min-h-dvh overflow-x-hidden bg-bg text-fg", standalone && "standalone")}
        data-standalone={standalone ? "true" : "false"}
      >
        <header className="app-header sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-fg">
                <Radar className="size-4" />
              </span>
              <span className="leading-none">
                <span className="block font-medium tracking-tight">SWARM</span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  {BRAND}
                </span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => {
                const active = pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                      active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
                  Auto
                </span>
                <Switch
                  checked={autopilot}
                  onCheckedChange={setAutopilot}
                  aria-label="Autopilot"
                />
                {autopilot ? (
                  <span className="size-1.5 rounded-full bg-accent" style={{ animation: "pulse-dot 1.6s ease-in-out infinite" }} />
                ) : null}
              </label>
              <Link
                to="/install"
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm",
                  pathname === "/install" ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
                )}
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Get app</span>
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-6">{children}</main>
        <footer className="border-t border-border pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">{COPYRIGHT}</p>
            <p className="text-xs text-subtle">
              SWARM is a product of{" "}
              <a
                href={SITE}
                target="_blank"
                rel="noreferrer"
                className="text-muted underline-offset-4 hover:text-fg hover:underline"
              >
                multinicheai.com
              </a>
              . One-time license. No subscription.
            </p>
          </div>
        </footer>
        <nav className="app-tabbar fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg lg:hidden">
          {moreOpen ? (
            <div className="grid grid-cols-3 gap-1 border-b border-border px-2 py-2">
              {MORE.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex min-h-12 items-center justify-center gap-2 rounded-md text-xs",
                      active ? "bg-elevated text-accent" : "text-muted",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                to="/install"
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-md text-xs",
                  pathname === "/install" ? "bg-elevated text-accent" : "text-muted",
                )}
              >
                <Download className="size-4" />
                Install
              </Link>
            </div>
          ) : null}
          <div className="grid grid-cols-5">
            {PRIMARY.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wide",
                    active ? "text-accent" : "text-muted",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="max-w-full truncate px-0.5">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wide",
                moreOpen || moreActive ? "text-accent" : "text-muted",
              )}
              aria-expanded={moreOpen}
              aria-label="More"
            >
              <Ellipsis className="size-4" />
              <span>More</span>
            </button>
          </div>
        </nav>
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            className: "!bg-elevated !text-fg !border-border",
          }}
        />
      </div>
    </TooltipProvider>
  );
}