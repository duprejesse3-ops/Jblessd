import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Copy, Download, ExternalLink, Package } from "lucide-react";
import { PRODUCTS, SITE, SWARM_REPO, SWARM_SKU, COPYRIGHT } from "@/lib/catalog";
import { listingFor } from "@/lib/listing";
import { copyToClipboard, downloadText } from "@/lib/utils";
import { HijackPanel } from "@/components/hijack-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/product")({ component: ProductPage });

const TABS = [
  { id: "sql", label: "SQL" },
  { id: "catalog", label: "catalog.mts" },
  { id: "proof", label: "Live proof" },
  { id: "llms", label: "llms.txt" },
  { id: "page", label: "Product page" },
  { id: "schema", label: "JSON-LD" },
] as const;

function ProductPage() {
  const [sku, setSku] = useState(SWARM_SKU);
  const [copied, setCopied] = useState<string | null>(null);
  const product = PRODUCTS.find((p) => p.sku === sku) ?? PRODUCTS[0]!;
  const listing = useMemo(() => listingFor(product), [product]);
  const isSwarm = product.sku === SWARM_SKU;

  async function copy(label: string, text: string) {
    const ok = await copyToClipboard(text);
    if (!ok) {
      toast.message("Could not copy", { description: "Select the block and copy it yourself." });
      return;
    }
    setCopied(label);
    toast.success("Copied", { description: `${label} ready to paste onto multinicheai.com.` });
    window.setTimeout(() => setCopied((cur) => (cur === label ? null : cur)), 1600);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <Badge variant="accent">{product.sku} · {listing.priceLabel}</Badge>
        <h1 className="mt-4 text-4xl font-medium tracking-tight">Package it as a product for the site</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Spec sheet in the exact MultiNiche fields: Built for, Category, Format, Spec, cart URL.
          Copy SQL, fallback catalog, live proof, or llms.txt and paste. SWARM is SKU {SWARM_SKU}
          under Store & Site Owners.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">SKU to list</span>
          <select
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="h-11 rounded-md bg-elevated px-3 text-sm shadow-[var(--shadow-border)]"
          >
            {PRODUCTS.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.sku} · {p.name} · ${p.price}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => void copy("Full kit", listing.bundle)}>
          {copied === "Full kit" ? <Check className="size-4" /> : <Copy className="size-4" />}
          Copy full kit
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            downloadText(`${product.sku}-listing.md`, listing.bundle);
            toast.success("Downloaded listing kit");
          }}
        >
          <Download className="size-4" />
          Download kit
        </Button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="pt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">
              Live listing · {SITE.replace("https://", "")}
            </p>
            <div className="mt-4 rounded-lg bg-elevated p-5 shadow-[var(--shadow-border)]">
              <p className="font-mono text-[11px] uppercase tracking-widest text-subtle">
                {listing.categoryLabel} {product.sku} New
              </p>
              <h2 className="mt-3 text-2xl font-medium tracking-tight">{product.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{listing.blurb}</p>
              <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
                <Spec k="Built for" v={listing.nicheLabel} />
                <Spec k="Category" v={listing.categoryLabel} />
                <Spec k="Format" v={listing.siteFormat} />
                <Spec k="Spec" v={listing.spec} />
              </dl>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <p className="font-mono text-xl tabular-nums">{listing.priceLabel}</p>
                <Button asChild>
                  <a href={listing.cartUrl} target="_blank" rel="noreferrer">
                    Add to cart in store
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
              <p className="mt-3 text-xs text-subtle">Digital delivery is immediate.</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-subtle">
                {COPYRIGHT}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {isSwarm ? (
                  <Button asChild variant="outline">
                    <a href={SWARM_REPO} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <a href={listing.productUrl} target="_blank" rel="noreferrer">
                      Open site
                    </a>
                  </Button>
                )}
                {isSwarm ? (
                  <Button asChild variant="ghost">
                    <Link to="/install">Install the app</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-accent" />
                <h2 className="text-lg font-medium">Includes</h2>
              </div>
              <ul className="mt-4 space-y-2">
                {listing.includes.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-muted">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <h2 className="text-lg font-medium">FAQ for the listing</h2>
              <dl className="mt-4 space-y-4">
                {listing.faq.map((item) => (
                  <div key={item.q}>
                    <dt className="text-sm font-medium">{item.q}</dt>
                    <dd className="mt-1 text-sm text-muted">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <h2 className="text-lg font-medium">Hijack demand for this SKU</h2>
              <p className="mt-2 text-sm text-muted">{product.utterances[0]}</p>
              <div className="mt-4">
                <HijackPanel sku={product.sku} intent={product.utterances[0] ?? ""} compact />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {listing.related.length ? (
        <section>
          <h2 className="text-lg font-medium">Sits next to these on Store & Site Owners</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {listing.related.map((item) => (
              <a
                key={item.sku}
                href={`${SITE}/product/${item.sku}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] transition-shadow hover:shadow-[var(--shadow-border-hover)]"
              >
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-sm text-muted">{item.blurb}</p>
                <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
                  {item.price} · {item.sku}
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Paste-ready packets</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-subtle">{listing.handle}</p>
        </div>
        <Tabs defaultValue="sql">
          <TabsList className="h-auto w-full flex-wrap justify-start">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Packet tab="sql" label="SQL" text={listing.sql} copied={copied} onCopy={copy} />
          <Packet tab="catalog" label="catalog.mts" text={listing.catalogMts} copied={copied} onCopy={copy} />
          <Packet tab="proof" label="Live proof" text={listing.liveProof} copied={copied} onCopy={copy} />
          <Packet tab="llms" label="llms.txt" text={listing.llmsLine} copied={copied} onCopy={copy} />
          <Packet tab="page" label="Product page" text={listing.pageMarkdown} copied={copied} onCopy={copy} />
          <Packet tab="schema" label="JSON-LD" text={listing.jsonLd} copied={copied} onCopy={copy} />
        </Tabs>
      </section>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3">
      <dt className="text-subtle">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Packet({
  tab,
  label,
  text,
  copied,
  onCopy,
}: {
  tab: string;
  label: string;
  text: string;
  copied: string | null;
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <TabsContent value={tab}>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => void onCopy(label, text)}>
          {copied === label ? <Check className="size-4" /> : <Copy className="size-4" />}
          Copy
        </Button>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-elevated p-4 font-mono text-xs leading-relaxed text-muted shadow-[var(--shadow-border)] whitespace-pre-wrap">
        {text}
      </pre>
    </TabsContent>
  );
}
