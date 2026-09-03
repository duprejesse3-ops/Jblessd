# multiNicheAI 1.0 — Credit Pricing Plan

## Fair practice principles this plan follows
- **No expiring credits.** Credits a customer buys stay in their account until used. No "use it or lose it" clocks.
- **No surprise billing.** One-time credit packs only at launch — no auto-renewing subscription unless the customer opts in separately.
- **Cost shown before send.** The app shows the estimated credit cost of a message before it's sent, not after.
- **Clear refund policy.** Unused credit balances are refundable within 30 days of purchase, prorated for what's unused.
- **No dark patterns.** No pre-checked upsells, no forced "recommended" pack highlighted to look cheaper than it is per-credit.
- **Transparent conversion rate.** The credits-per-dollar and tokens-per-credit math is published on the pricing page, not hidden in fine print.

## Cost basis (what you're actually paying per message)
Using Claude API pricing as the underlying model cost. Actual $/token varies by model tier — plug in the current published rate for whichever model you use (e.g. a faster/cheaper model for routine chat, a stronger model as a paid upgrade tier).

Rough estimate for planning purposes:
- Average chat message exchange (user question + assistant response): ~500-800 tokens combined
- Underlying API cost per exchange: fractions of a cent to a few cents, depending on model tier and response length

## Suggested credit unit
1 credit = 1 typical chat exchange (short-to-medium question + answer)
- Longer responses or brainstorm/build requests may cost more than 1 credit (shown to the user beforehand)
- This keeps the unit intuitive for customers — "credits" map to "messages," not to confusing token counts

## Suggested pack pricing (example — adjust margin to your comfort)
| Pack | Credits | Price | Price per credit |
|---|---|---|---|
| Starter | 100 | $5 | $0.050 |
| Standard | 500 | $20 | $0.040 |
| Pro | 1,500 | $50 | $0.033 |
| Power | 5,000 | $150 | $0.030 |

Larger packs get a modest per-credit discount (standard, fair volume pricing) — not so steep that small buyers feel penalized for not committing upfront.

## Margin math
Set your per-credit price at roughly 3-6x your underlying API cost per exchange. That covers:
- Model API costs
- Server/infrastructure costs
- Stripe processing fees (~2.9% + $0.30 per transaction)
- Your margin

Once you have real usage data (average tokens per exchange, model choice), I can plug in exact numbers and tighten this.

## What's NOT in this plan (flag if you want it)
- Subscription/monthly tier — deliberately left out for v1 to avoid recurring-billing complexity and stay in the "pay once, own it" spirit of your other MultiConnect products
- Free trial credits — worth considering for conversion, e.g. 10 free credits on signup
