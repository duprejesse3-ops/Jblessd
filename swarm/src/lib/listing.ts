import { BRAND, COPYRIGHT, COPYRIGHT_YEAR, SITE, SWARM_REPO, SWARM_SKU } from "./catalog";
import type { Format, Product } from "./types";

export type SiteCategory = "prompts" | "automations" | "templates" | "agents" | "connectors" | "host";
export type SiteNiche =
  | "founders"
  | "sales"
  | "marketers"
  | "developers"
  | "writers"
  | "students"
  | "architects"
  | "engineers"
  | "office"
  | "finance"
  | "stores";

export const CATEGORY_LABEL: Record<SiteCategory, string> = {
  prompts: "Prompt Packs",
  automations: "Automation Blueprints",
  templates: "Doc Templates",
  agents: "Agent Configs",
  connectors: "Connectors",
  host: "Host Packs",
};

export const NICHE_LABEL: Record<SiteNiche, string> = {
  founders: "Founders & Ops",
  sales: "Sales & CS",
  marketers: "Marketers",
  developers: "Developers",
  writers: "Writers",
  students: "Students & Researchers",
  architects: "Architects",
  engineers: "Engineers",
  office: "Office & Admin",
  finance: "Finance & Investing",
  stores: "Store & Site Owners",
};

export type SiteListing = {
  product: Product;
  category: SiteCategory;
  niche: SiteNiche;
  categoryLabel: string;
  nicheLabel: string;
  siteFormat: string;
  spec: string;
  handle: string;
  title: string;
  blurb: string;
  priceLabel: string;
  productUrl: string;
  cartUrl: string;
  toolsUrl: string;
  catalogLine: string;
  catalogHtml: string;
  catalogMts: string;
  sql: string;
  liveProof: string;
  liveProofVerb: string;
  llmsLine: string;
  pageMarkdown: string;
  jsonLd: string;
  metaTitle: string;
  metaDescription: string;
  includes: string[];
  faq: { q: string; a: string }[];
  related: { name: string; sku: string; price: string; blurb: string }[];
  bundle: string;
};

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sqlEscape(value: string) {
  return value.replaceAll("'", "''");
}

function jsEscape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

export function siteCategoryOf(format: Format): SiteCategory {
  switch (format) {
    case "Prompt Pack":
      return "prompts";
    case "Automation":
      return "automations";
    case "Template":
      return "templates";
    case "Agent":
      return "agents";
    case "Connector":
      return "connectors";
    case "Host":
      return "host";
    default:
      return "automations";
  }
}

export function siteNicheOf(role: string): SiteNiche {
  const map: Record<string, SiteNiche> = {
    "Founders & Ops": "founders",
    "Sales & CS": "sales",
    Marketers: "marketers",
    Developers: "developers",
    Writers: "writers",
    "Students & Researchers": "students",
    Architects: "architects",
    Engineers: "engineers",
    "Office & Admin": "office",
    "Finance & Investing": "finance",
    "Store & Site Owners": "stores",
  };
  return map[role] ?? "founders";
}

function siteFormatOf(product: Product) {
  if (product.sku === SWARM_SKU) return "Installed app · GitHub source · one-time license";
  switch (product.format) {
    case "Prompt Pack":
      return "PDF + Notion";
    case "Automation":
      return "Blueprint · one-time license";
    case "Agent":
      return "System prompt + template";
    case "Template":
      return "Markdown + working doc";
    case "Connector":
      return "Downloadable app · one-time license";
    case "Host":
      return ".zip · one-time license";
    default:
      return product.format;
  }
}

function specOf(product: Product) {
  if (product.sku === SWARM_SKU) {
    return "Chrome/Edge PWA · Android + Windows · local genome · copy-ready packets";
  }
  return product.proof;
}

function blurbOf(product: Product) {
  if (product.sku === SWARM_SKU) {
    return "Hijacks demand that already exists and evolves proof-first ads on autopilot. Maps a pain-utterance to a SKU, spawns eight organisms, kills losers. Not a Google Ads account.";
  }
  return product.job.replace(/\.$/, "") + ".";
}

function includesFor(product: Product) {
  if (product.sku === SWARM_SKU) {
    return [
      "Installed app for Android (Chrome) and Windows (Edge/Chrome)",
      "Full source on GitHub",
      "Autopilot genome — local, no API spend",
      "Copy-ready packets: search, conversation, proof-loop, shadow",
      "Site listing kit for every MultiNiche SKU",
    ];
  }
  switch (product.format) {
    case "Prompt Pack":
      return ["PDF", "Notion database", "Watch a run on your own task"];
    case "Automation":
      return ["Blueprint", "Run notes", "Watch a run on your own task"];
    case "Agent":
      return ["System prompt", "Config sheet", "Watch a run on your own task"];
    case "Template":
      return ["Markdown", "Working doc", "Watch a run on your own task"];
    case "Connector":
      return ["App download", "One-time license", "Runs on your machine"];
    case "Host":
      return [".zip", "./install.sh", "Perpetual license, no rent"];
    default:
      return ["Digital delivery", "One-time payment"];
  }
}

function faqFor(product: Product) {
  if (product.sku === SWARM_SKU) {
    return [
      {
        q: "Is this a Google Ads account?",
        a: "No. SWARM writes proof-first packets you paste into search, threads, and listings. Autopilot evolves what wins.",
      },
      {
        q: "Does Autopilot burn Grok quota?",
        a: "No. Autopilot uses the local genome. Grok writes copy only when you flip that switch.",
      },
      {
        q: "Is there a Play Store or Microsoft Store app?",
        a: "No store listing. Chrome or Edge → Install app. Home screen, Start menu, taskbar.",
      },
      {
        q: "Subscription?",
        a: "$79.00 one-time. Source included. Bundle 3+ different tools on MultiNiche for 15% off.",
      },
    ];
  }
  return [
    {
      q: "What do I actually get?",
      a: `${product.format} for ${product.role}. ${product.job}.`,
    },
    {
      q: "Can I watch it before I pay?",
      a: "Yes. Watch it run on your own task first. Spec sheet, not a pitch.",
    },
    {
      q: "Subscription?",
      a: `$${product.price.toFixed(2)} one-time. Credits never expire. Bundle 3+ different tools for 15% off.`,
    },
  ];
}

function liveProofFor(product: Product) {
  if (product.sku === SWARM_SKU) {
    return {
      verb: "Simulating one run of this automation",
      text: [
        'Trigger: intent pulse — "I have a catalog and no traffic" (search, heat 0.86), mapped to Inbox Zero Automation.',
        "Hijack: Autopilot spawns eight organisms across four native forms — search intercept, conversation native, proof-loop spec sheet, shadow listing. Local genome writes the copy. No API call.",
        "Tick: 14 simulated hours. Proof-loop CTR 6.8 percent, 3 conversions. Search intercept spends $11.20 for one conversion. Two conversation natives die.",
        "Evolve: generation 2 keeps the spec-sheet champion and a mutated shadow listing. Losers killed.",
        "Output: a paste-ready packet with a UTM link to multinicheai.com/product/AI-AB-002. Autopilot arms the next unused SKU without a click.",
      ].join("\n\n"),
    };
  }
  return {
    verb: "Watching a representative run",
    text: `Input: ${product.utterances[0] ?? product.job}.\n\nResult: ${product.proof}. ${product.job}. $${product.price.toFixed(2)} one-time. Watch it on your own task before you buy.`,
  };
}

const SWARM_RELATED = [
  {
    name: "Site Audit Agent (Source Code)",
    sku: "AI-AG-065",
    price: "$79.00",
    blurb: "Sixteen checks, four schedulers. Unzip, run ./install.sh.",
  },
  {
    name: "Meridian Host",
    sku: "AI-HOST-001",
    price: "$99.00",
    blurb: "Load your GitHub on a Pi or laptop. Take money on hardware you own.",
  },
  {
    name: "MultiConnect: Shopify",
    sku: "AI-CN-002",
    price: "$59.00",
    blurb: "Inventory, orders, and instant triggers in sync with your agent.",
  },
  {
    name: "Content Calendar Autopilot",
    sku: "AI-AB-005",
    price: "$24.00",
    blurb: "Drafts posts from your notes and queues them by channel.",
  },
];

export function listingFor(product: Product): SiteListing {
  const category = siteCategoryOf(product.format);
  const niche = siteNicheOf(product.role);
  const categoryLabel = CATEGORY_LABEL[category];
  const nicheLabel = NICHE_LABEL[niche];
  const siteFormat = siteFormatOf(product);
  const spec = specOf(product);
  const handle = slug(product.name);
  const includes = includesFor(product);
  const faq = faqFor(product);
  const proof = liveProofFor(product);
  const priceLabel = `$${product.price.toFixed(2)}`;
  const blurb = blurbOf(product);
  const productUrl = `${SITE}/product/${product.sku}`;
  const cartUrl = `${SITE}/?product=${encodeURIComponent(product.sku)}`;
  const toolsUrl = `${SITE}/tools/${niche}`;
  const catalogLine = `- [${product.name}](${productUrl}) — ${categoryLabel}, ${priceLabel}. ${blurb} (${siteFormat})`;
  const catalogHtml = `<article data-sku="${product.sku}">
  <p>${categoryLabel} ${product.sku} New</p>
  <h1>${product.name}</h1>
  <p>${blurb}</p>
  <dl>
    <div><dt>Built for</dt><dd>${nicheLabel}</dd></div>
    <div><dt>Category</dt><dd>${categoryLabel}</dd></div>
    <div><dt>Format</dt><dd>${siteFormat}</dd></div>
    <div><dt>Spec</dt><dd>${spec}</dd></div>
  </dl>
  <p>${priceLabel}</p>
  <a href="${cartUrl}">Add to cart in store →</a>
  <p>${COPYRIGHT}</p>
</article>`;
  const catalogMts = `{ sku: '${product.sku}', name: '${jsEscape(product.name)}', category: '${category}', niche: '${niche}', format: '${jsEscape(siteFormat)}', price: ${product.price}, blurb: '${jsEscape(blurb)}', spec: '${jsEscape(spec)}' },`;
  const sql = `-- Adds ${sqlEscape(product.name)} (${product.sku}) to the catalog.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('${product.sku}', '${sqlEscape(product.name)}', '${category}', '${niche}', '${sqlEscape(siteFormat)}', ${product.price.toFixed(2)}, '${sqlEscape(blurb)}', '${sqlEscape(spec)}')
ON CONFLICT (sku) DO NOTHING;`;
  const liveProof = [
    `  '${product.sku}': {`,
    `    verb: '${jsEscape(proof.verb)}',`,
    `    text:`,
    `      ${proof.text
      .split("\n\n")
      .map((para, i, arr) => `'${jsEscape(para)}${i < arr.length - 1 ? "\\n\\n" : ""}'${i < arr.length - 1 ? " +" : ","}`)
      .join("\n      ")}`,
    `  },`,
  ].join("\n");
  const pageMarkdown = [
    `${categoryLabel}  ${product.sku}  New`,
    "",
    `# ${product.name}`,
    "",
    blurb,
    "",
    `Built for ${nicheLabel}`,
    `Category ${categoryLabel}`,
    `Format ${siteFormat}`,
    `Spec ${spec}`,
    "",
    `${priceLabel}  [Add to cart in store →](${cartUrl})`,
    "",
    "Digital delivery is immediate.",
    "Sales are final after access is provided, subject to the refund policy.",
    "",
    "## Includes",
    ...includes.map((item) => `- ${item}`),
    "",
    "## The pain it intercepts",
    product.pain,
    "",
    "## Queries it hijacks",
    ...product.queries.map((q) => `- ${q}`),
    "",
    "## FAQ",
    ...faq.flatMap((item) => [`### ${item.q}`, item.a, ""]),
    product.sku === SWARM_SKU ? `Source: ${SWARM_REPO}` : `Product: ${productUrl}`,
    "",
    COPYRIGHT,
  ].join("\n");
  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.sku,
      category: categoryLabel,
      description: blurb,
      brand: { "@type": "Brand", name: BRAND },
      copyrightHolder: { "@type": "Organization", name: BRAND, url: SITE },
      copyrightNotice: COPYRIGHT,
      copyrightYear: COPYRIGHT_YEAR,
      image: `${SITE}/multiniche-ai-og.png`,
      url: productUrl,
      offers: {
        "@type": "Offer",
        price: product.price.toFixed(2),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: productUrl,
        priceValidUntil: "2027-12-31",
      },
    },
    null,
    2,
  );
  const metaTitle = `${product.name} — ${categoryLabel} | ${BRAND}`;
  const metaDescription = `${blurb} ${priceLabel} one-time.`;
  const bundle = [
    "# MultiNiche listing kit",
    "",
    catalogLine,
    "",
    "## SQL (netlify/database/migrations)",
    sql,
    "",
    "## Fallback catalog.mts",
    catalogMts,
    "",
    "## Live proof (demo-library.mts)",
    liveProof,
    "",
    "## Product page",
    pageMarkdown,
    "",
    "## JSON-LD",
    jsonLd,
    "",
    `Meta title: ${metaTitle}`,
    `Meta description: ${metaDescription}`,
    `Cart: ${cartUrl}`,
    `Page: ${productUrl}`,
    `Tools: ${toolsUrl}`,
    "",
    COPYRIGHT,
  ].join("\n");
  return {
    product,
    category,
    niche,
    categoryLabel,
    nicheLabel,
    siteFormat,
    spec,
    handle,
    title: product.name,
    blurb,
    priceLabel,
    productUrl,
    cartUrl,
    toolsUrl,
    catalogLine,
    catalogHtml,
    catalogMts,
    sql,
    liveProof,
    liveProofVerb: proof.verb,
    llmsLine: catalogLine,
    pageMarkdown,
    jsonLd,
    metaTitle,
    metaDescription,
    includes,
    faq,
    related: product.sku === SWARM_SKU ? SWARM_RELATED : [],
    bundle,
  };
}
