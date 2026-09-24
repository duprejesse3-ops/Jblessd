import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FORMATS, PRODUCTS, ROLES, SITE, SWARM_SKU, productImageSrc } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { listingFor } from "@/lib/listing";
import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";
import { HijackPanel } from "@/components/hijack-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/catalog")({ component: CatalogPage });

function CatalogPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("All");
  const [format, setFormat] = useState("All");
  const [open, setOpen] = useState<string | null>(SWARM_SKU);
  const list = useMemo(() => {
    return PRODUCTS.filter((p) => {
      if (role !== "All" && p.role !== role) return false;
      if (format !== "All" && p.format !== format) return false;
      if (!q.trim()) return true;
      const blob = `${p.name} ${p.sku} ${p.job} ${p.pain} ${p.queries.join(" ")}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [q, role, format]);
  const selected = PRODUCTS.find((p) => p.sku === open) ?? list[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">Intent map</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Every SKU is a cluster of utterances</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          You do not advertise MultiNiche as “an AI store.” You intercept the job each instrument
          already does. Pick a product, hijack one of its sentences, ship a swarm — or copy a
          spec-sheet listing and paste it onto the site.
        </p>
      </div>

      <Link
        to="/product"
        className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] hover:bg-elevated sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">
            {SWARM_SKU} · $79.00 · Automation
          </p>
          <p className="mt-1 font-medium">SWARM is a product on the site, not only a lab</p>
          <p className="mt-1 text-sm text-muted">
            Spec sheet, SQL, live proof, llms.txt — ready to paste.
          </p>
        </div>
        <span className="text-sm text-accent">Open the listing kit</span>
      </Link>

      <div className="flex flex-col gap-3 md:flex-row">
        <Input
          id="catalog-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jobs, SKUs, pains"
          className="md:max-w-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-11 rounded-md bg-elevated px-3 text-sm shadow-[var(--shadow-border)]"
        >
          <option>All</option>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="h-11 rounded-md bg-elevated px-3 text-sm shadow-[var(--shadow-border)]"
        >
          <option>All</option>
          {FORMATS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <ul className="flex flex-col gap-2">
          {list.map((p) => (
            <li key={p.sku}>
              <button
                type="button"
                onClick={() => setOpen(p.sku)}
                className="flex w-full gap-3 rounded-xl bg-surface p-3 text-left shadow-[var(--shadow-border)] hover:bg-elevated"
              >
                <img
                  src={productImageSrc(p.sku)}
                  alt=""
                  className="size-16 shrink-0 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-white/10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
                      {p.sku}
                    </span>
                    <span className="font-mono text-sm tabular-nums">${p.price}</span>
                  </div>
                  <p className="mt-1 font-medium">{p.name}</p>
                  <p className="mt-1 text-sm text-muted">{p.job}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{p.format}</Badge>
                    <Badge variant="accent">{p.role}</Badge>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
        {selected ? <ProductDetail key={selected.sku} product={selected} /> : null}
      </div>
    </div>
  );
}

function ProductDetail({ product }: { product: Product }) {
  const [intent, setIntent] = useState(product.utterances[0] ?? "");
  const listing = listingFor(product);
  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardContent className="p-0 pt-0">
        <img
          src={productImageSrc(product.sku)}
          alt={product.name}
          className="aspect-[3/2] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
        />
        <div className="p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">{product.sku}</p>
        <h2 className="mt-1 text-xl font-medium">{product.name}</h2>
        <p className="mt-2 text-sm text-muted">{product.pain}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row k="Proof" v={product.proof} />
          <Row k="Job" v={product.job} />
          <Row k="Landing" v={`${SITE}${product.landing}`} />
        </dl>
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-widest text-subtle">Utterances to hijack</p>
          <ul className="mt-2 space-y-2">
            {product.utterances.map((u) => (
              <li key={u}>
                <button
                  type="button"
                  onClick={() => setIntent(u)}
                  className="w-full rounded-lg bg-elevated px-3 py-2 text-left text-sm shadow-[var(--shadow-border)]"
                >
                  {u}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-widest text-subtle">Long-tail queries</p>
          <p className="mt-2 font-mono text-xs text-muted">{product.queries.join(" · ")}</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={() =>
              void copyToClipboard(listing.bundle).then((ok) => {
                if (ok) toast.success("Listing kit copied", { description: "Paste onto multinicheai.com." });
                else toast.message("Copy failed");
              })
            }
          >
            Copy site listing
          </Button>
          <Button asChild variant="ghost">
            <Link to="/product">Open listing kit</Link>
          </Button>
        </div>
        <div className="mt-4">
          <HijackPanel sku={product.sku} intent={intent} />
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2">
      <dt className="text-muted">{k}</dt>
      <dd className="max-w-[70%] text-right">{v}</dd>
    </div>
  );
}
