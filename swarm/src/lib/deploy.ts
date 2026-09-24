import { productBySku, SITE } from "./catalog";
import type { Channel, Destinations, Organism } from "./types";
import { copyToClipboard } from "./utils";

export type DeployTarget = {
  id: string;
  label: string;
  href: string;
  hint: string;
};

export const DEFAULT_DESTINATIONS: Destinations = {
  xHandle: "DupreJesse14633",
  redditUser: "MultiNicheAI81",
  redditSub: "smallbusiness",
};

export const REDDIT_SUBS = [
  "smallbusiness",
  "Entrepreneur",
  "productivity",
  "automation",
  "ChatGPT",
  "SEO",
  "sales",
];

/** Main-feed product posts get removed here. Promo sticky only. */
export const REDDIT_PROMO_THREAD: Record<string, { reason: string; search: string }> = {
  smallbusiness: {
    reason:
      "r/smallbusiness only allows product posts in the weekly Promote-your-business sticky. A feed post with an AI product, a landing URL, or an ad image gets removed and can ban the account.",
    search:
      "https://www.reddit.com/r/smallbusiness/search/?q=Promote%20your%20business&restrict_sr=1&sort=new&t=month",
  },
  entrepreneur: {
    reason: "r/Entrepreneur treats a product post in the feed as spam. Use their weekly promo thread.",
    search:
      "https://www.reddit.com/r/Entrepreneur/search/?q=Promote%20your%20business&restrict_sr=1&sort=new&t=month",
  },
  startups: {
    reason: "r/startups removes product pitches from the feed. Showcase goes in their weekly thread.",
    search:
      "https://www.reddit.com/r/startups/search/?q=Promote%20your%20startup&restrict_sr=1&sort=new&t=month",
  },
};

export function destOf(dest?: Destinations | null): Destinations {
  return {
    xHandle: stripAt(dest?.xHandle || DEFAULT_DESTINATIONS.xHandle),
    redditUser: stripAt(dest?.redditUser || DEFAULT_DESTINATIONS.redditUser),
    redditSub: stripSub(dest?.redditSub || DEFAULT_DESTINATIONS.redditSub),
  };
}

function stripAt(value: string) {
  return value.trim().replace(/^@/, "");
}

function stripSub(value: string) {
  return value.trim().replace(/^\/?(r\/)?/i, "").replace(/\s+/g, "");
}

export function redditPolicy(sub?: string) {
  return REDDIT_PROMO_THREAD[stripSub(sub || "").toLowerCase()] ?? null;
}

export function redditComment(organism: Organism, dest?: Destinations) {
  const d = destOf(dest);
  const product = productBySku(organism.sku);
  const name = product?.name ?? organism.sku;
  const maker = d.redditUser
    ? `Built by u/${d.redditUser} — happy to answer implementation questions in the thread, no DMs.`
    : "Happy to answer implementation questions in the thread — no DMs.";
  // Deliberately not organism.body: that copy is written for paid-channel
  // ad slots (X, Google) and leads with price by design there. Reddit gets
  // its own voice built straight from the product's job/proof/format —
  // what it does and how, no price, no "buy" framing. r/smallbusiness and
  // similar subs ban feed posts that read as an ad; this is meant to read
  // as a dev sharing something they built, not a pitch.
  const article = product && /^[aeiou]/i.test(product.format) ? "an" : "a";
  const whatItIs = product
    ? `${product.job} Built as ${article} ${product.format.toLowerCase()}.`
    : organism.headline;
  return [
    name,
    whatItIs,
    organism.proofHook,
    `Spec / source: ${organism.landingUrl}`,
    maker,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function organismPacket(organism: Organism) {
  if (organism.channel === "search") return googleAdsCopy(organism);
  return [
    organism.headline,
    "",
    organism.body,
    "",
    `Proof: ${organism.proofHook}`,
    `CTA: ${organism.cta}`,
    organism.landingUrl,
  ].join("\n");
}

export function googleAdsCopy(organism: Organism) {
  const product = productBySku(organism.sku);
  const h1 = clip(organism.headline, 30);
  const h2 = clip(product?.name ?? organism.sku, 30);
  const d1 = clip(organism.body, 90);
  return [
    `Headline 1: ${h1}`,
    `Headline 2: ${h2}`,
    `Description: ${d1}`,
    `Final URL: ${organism.landingUrl}`,
  ].join("\n");
}

function clip(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

export function tweetText(organism: Organism) {
  const core = `${organism.headline}\n\n${organism.body}\n\n${organism.landingUrl}`;
  return core.length <= 280 ? core : `${organism.headline}\n\n${organism.landingUrl}`.slice(0, 280);
}

export function redditSubmitUrl(organism: Organism, dest?: Destinations) {
  const d = destOf(dest);
  const sub = d.redditSub || "smallbusiness";
  const policy = redditPolicy(sub);
  if (policy) return policy.search;
  const product = productBySku(organism.sku);
  const title = clip(`${product?.name ?? organism.sku} — ${organism.proofHook}`, 300);
  const body = redditComment(organism, d);
  return `https://www.reddit.com/r/${encodeURIComponent(sub)}/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(body)}`;
}

export function xIntentUrl(organism: Organism) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText(organism))}`;
}

export function xProfileUrl(dest?: Destinations) {
  const handle = destOf(dest).xHandle;
  return handle ? `https://x.com/${encodeURIComponent(handle)}` : "https://x.com/";
}

export function redditUserUrl(dest?: Destinations) {
  const user = destOf(dest).redditUser;
  return user ? `https://www.reddit.com/user/${encodeURIComponent(user)}` : "https://www.reddit.com/";
}

export function deployTargets(organism: Organism, dest?: Destinations): DeployTarget[] {
  const d = destOf(dest);
  const x: DeployTarget = {
    id: "x",
    label: d.xHandle ? `Post on X` : "Post on X",
    href: xIntentUrl(organism),
    hint: `Opens X compose as @${d.xHandle || "you"}. Tap Post in X to publish.`,
  };
  const policy = redditPolicy(d.redditSub);
  const reddit: DeployTarget = {
    id: "reddit",
    label: policy ? "Reddit promo thread" : "Post Reddit",
    href: redditSubmitUrl(organism, d),
    hint: policy
      ? `r/${d.redditSub} bans feed ads. Copies a comment and opens this week's Promote-your-business sticky.`
      : `Opens r/${d.redditSub} as u/${d.redditUser || "you"} as a named product, not a fake question.`,
  };
  if (organism.channel === "search") {
    return [
      x,
      reddit,
      {
        id: "google-ads",
        label: "Google Ads",
        href: "https://ads.google.com/aw/campaigns",
        hint: "Packet is RSA-ready. Paste into a Search campaign. Google bills that account — SWARM does not.",
      },
    ];
  }
  if (organism.channel === "proof") {
    return [
      x,
      reddit,
      {
        id: "site",
        label: "Open spec",
        href: organism.landingUrl,
        hint: "Proof-loop spec on multinicheai.com. The UTM link is live.",
      },
    ];
  }
  if (organism.channel === "conversation") return [x, reddit];
  return [reddit, x];
}

export function deployTarget(organism: Organism, dest?: Destinations): DeployTarget {
  return deployTargets(organism, dest)[0]!;
}

export function channelVerb(channel: Channel) {
  if (channel === "search") return "Ship to Google Ads";
  if (channel === "conversation") return "Post on X + Reddit";
  if (channel === "proof") return "Open the live spec";
  return "Post to Reddit";
}

export async function copyOrganismPacket(organism: Organism) {
  return copyToClipboard(organismPacket(organism));
}

export async function copyForTarget(organism: Organism, target: DeployTarget, dest?: Destinations) {
  if (target.id === "reddit") {
    return copyToClipboard(redditComment(organism, dest));
  }
  return copyOrganismPacket(organism);
}

export async function shareOrganism(organism: Organism) {
  const text = organismPacket(organism);
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: organism.headline,
        text,
        url: organism.landingUrl,
      });
      return "shared" as const;
    } catch {
      // cancelled
    }
  }
  const ok = await copyToClipboard(text);
  return ok ? ("copied" as const) : ("failed" as const);
}

export function statusIdFromUrl(url: string) {
  const match = url.match(/status\/(\d+)/);
  return match?.[1];
}

export function interceptReply(sku: string) {
  const product = productBySku(sku);
  if (!product) return "";
  const landing = product.landing.startsWith("http")
    ? product.landing
    : `${SITE}${product.landing.startsWith("/") ? product.landing : `/${product.landing}`}`;
  return `${product.proof}. ${product.name} — $${product.price} one-time.\n${landing}?utm_source=swarm&utm_medium=x-reply&sku=${product.sku}`;
}

export function replyIntentUrl(opts: { postUrl?: string; sku: string }) {
  const text = interceptReply(opts.sku);
  const params = new URLSearchParams({ text });
  const id = opts.postUrl ? statusIdFromUrl(opts.postUrl) : undefined;
  if (id) params.set("in_reply_to", id);
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
