# Model cost audit

Every place this site calls Claude, what it costs, and what it would cost on a
cheaper model. Prices confirmed against Anthropic's published pricing page on
2026-08-12.

## Prices

| Model | Input $/1M | Output $/1M | Tokenizer |
|---|---|---|---|
| Claude Opus 4.8 | $5.00 | $25.00 | new |
| Claude Sonnet 4.5 | $3.00 | $15.00 | old |
| Claude Sonnet 5 | $2.00 | $10.00 | new |
| Claude Haiku 4.5 | $1.00 | $5.00 | old |

**The tokenizer column changes the arithmetic.** Claude 4.7 and later — which
includes Opus 4.8 and Sonnet 5 — use a newer tokenizer that produces roughly 30%
more tokens for the same text. Sonnet 4.5 and Haiku 4.5 use the old one. So the
sticker price is not the whole comparison: for the same piece of English,

- Opus 4.8 → Sonnet 5 is **2.5× cheaper** (same tokenizer, pure price ratio)
- Opus 4.8 → Haiku 4.5 is **~6.5× cheaper** (5× on price, ~1.3× on token count)
- Sonnet 4.5 → Sonnet 5 is **~13% cheaper**, not the 33% the prices suggest
- Sonnet 4.5 → Haiku 4.5 is **3× cheaper**

All per-1,000-call figures below assume ~1,200 input tokens and output running
to 70% of each site's `max_tokens`. Scale them linearly against real usage —
they are for comparing sites to each other, not for forecasting a bill.

## The three Opus call sites

| Site | `max_tokens` | Per 1,000 calls | At Sonnet 5 | At Haiku 4.5 |
|---|---|---|---|---|
| `netlify/lib/ai-deliverable.mts` | 4000 | **$77.50** | $31.00 | $11.92 |
| `netlify/functions/run-product.mts` | 1400 | **$30.50** | $12.20 | $4.69 |
| `netlify/functions/demo.mts` | 900 | **$20.75** | $8.30 | $3.19 |

**None of these is on Opus for no reason.** All three are metered or cached in a
way that keeps the call count small, and all three are the thing the customer is
actually paying for:

- `ai-deliverable.mts` writes the artifact a buyer keeps. It runs **once per SKU**
  and caches the result under a version key. The catalog holds **65 SKUs**, so
  the entire lifetime cost of the most expensive-per-call site on the site is
  **about $5** — and moving it to Haiku would save **about $4.25, once, ever**,
  in exchange for worse paid deliverables. This is the clearest case in the
  codebase for leaving a model alone.
- `run-product.mts` runs only after a completed Stripe checkout. Call volume is
  bounded by sales, and every call has already been paid for.
- `demo.mts` caches the default per-SKU demo in Blobs, so the common path costs
  nothing. Only custom scenarios pay for fresh inference, and those are rate
  limited to 10 per hour per IP.

The comment on each of these lines already says as much. They were deliberate.

## The actual finding: seven sites on a model that costs more than its successor

| Site | `max_tokens` | Now (Sonnet 4.5) | At Sonnet 5 | At Haiku 4.5 |
|---|---|---|---|---|
| `google-ads-builder.mts` | 2048 | $25.11 | $21.76 | $8.37 |
| `marketing-agent.mts` | 2048 | $25.11 | $21.76 | $8.37 |
| `admin-console.mts` | 1400 | $18.30 | $15.86 | $6.10 |
| `chat.mts` | 1024 | $14.36 | $12.44 | $4.79 |
| `concierge.mts` | 1024 | $14.36 | $12.44 | $4.79 |
| `product-builder.mts` | 1024 | $14.36 | $12.44 | $4.79 |
| `describe.mts` | 512 | $8.97 | $7.77 | $2.99 |

Sonnet 5 is **cheaper than Sonnet 4.5 on both input and output** ($2/$10 against
$3/$15) and is the newer, more capable model. After the tokenizer difference the
real saving is about 13%, which is small — but it is a saving in exchange for a
*better* model, which is unusual and worth taking on its own terms rather than
for the money.

Two of these are worth a second look for a Haiku move rather than a Sonnet one,
on volume grounds rather than quality:

- `describe.mts` — short marketing copy, 512 tokens. The least demanding call
  on the site.
- `concierge.mts` — picks a bundle from the catalog. Closer to structured
  selection than open-ended writing.

`chat.mts` is the one to be most careful with: it is the visitor-facing
conversation, it is unauthenticated, and it is the highest-volume path. It is
also where a weaker model is most visible to a stranger.

## Already at the floor

| Site | Model | Schedule |
|---|---|---|
| `site-maintenance-agent.mts` | Haiku 4.5 | hourly |
| `discovery-crawler.mts` | Haiku 4.5 | daily 03:00 |

Together these are the only calls that happen when nobody is visiting — roughly
730 a month, around **$1.50**. Nothing to reclaim here.

`netlify/lib/credits.mts` already exposes Haiku 4.5 / Sonnet 5 / Opus 5 as the
Quick / Standard / Deep agent tiers at 1 / 3 / 9 credits. That mapping is
consistent with the prices above.

## If you make the swap

No call site in `netlify/` sets `temperature`, `top_p`, `top_k`, or a `thinking`
block, so Sonnet 4.5 → Sonnet 5 is a one-line model-string change at each of the
seven sites with no other edits required.

The one thing to watch: **`max_tokens` counts the model's own tokens.** Sonnet 5
produces ~30% more tokens for the same English, so leaving `max_tokens` where it
is will make the output about 30% shorter and can truncate mid-sentence. Raise
each cap by roughly a third when you switch — `describe.mts` from 512 to ~670,
`chat.mts` from 1024 to ~1330, and so on.

## What this adds up to

Model choice is not where this site's money is. The Opus sites are cheap because
they are cached or bought; the Sonnet sites are the volume, and the best
available move there saves ~13% while *improving* the model. If the AI bill ever
gets uncomfortable, the lever is `chat.mts` volume, not the model on it.
