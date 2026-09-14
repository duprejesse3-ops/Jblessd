import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { localCopy, CHANNELS } from "./genome.ts";
import { PRODUCTS } from "./catalog.ts";

const product = PRODUCTS.find((p) => p.sku === "AI-AB-037") ?? PRODUCTS[0]!;
const intent = product.utterances[0] ?? product.job;

describe("localCopy", () => {
  it("is deterministic — same salt always produces the same organism", () => {
    const a = localCopy(product, intent, "search", 42);
    const b = localCopy(product, intent, "search", 42);
    assert.deepEqual(a, b);
  });

  it("produces real variance across salts — more than the old 3-per-channel ceiling", () => {
    // The old implementation had exactly 3 possible (headline, body) pairs
    // per channel, period — spawnLocalSwarm's and evolveLocal's own
    // headline-collision retries were routinely exhausting it. Sampling 40
    // salts per channel should turn up well more than 3 distinct pairs if
    // the independent-index fix actually works.
    for (const ch of CHANNELS) {
      const seen = new Set<string>();
      for (let salt = 0; salt < 40; salt++) {
        const copy = localCopy(product, intent, ch.id, salt);
        seen.add(`${copy.headline}\u0000${copy.body}`);
      }
      assert.ok(
        seen.size > 3,
        `channel "${ch.id}" only produced ${seen.size} distinct (headline, body) pairs across 40 salts — expected more than the old ceiling of 3`,
      );
    }
  });

  it("headline and body vary independently, not locked to the same index", () => {
    // Specifically checks the bug this fixes: previously headline[i] was
    // always paired with body[i] for the same i, so no headline ever
    // appeared with more than one body. Look for at least one headline that
    // shows up paired with two different bodies across a salt sweep.
    const byHeadline = new Map<string, Set<string>>();
    for (let salt = 0; salt < 60; salt++) {
      const copy = localCopy(product, intent, "search", salt);
      const bodies = byHeadline.get(copy.headline) ?? new Set<string>();
      bodies.add(copy.body);
      byHeadline.set(copy.headline, bodies);
    }
    const someHeadlineHasMultipleBodies = [...byHeadline.values()].some((bodies) => bodies.size > 1);
    assert.ok(someHeadlineHasMultipleBodies, "expected at least one headline to appear with more than one body");
  });

  it("pulls real per-product queries/utterances into the headline pool, not just hardcoded strings", () => {
    // product.utterances[0] is used as `intent` itself, so check that a
    // *different* utterance than the one passed as intent shows up as a
    // headline somewhere in a salt sweep — proof this is real catalog data,
    // not just the four hand-written base phrasings.
    const otherUtterance = product.utterances.find((u) => u !== intent);
    if (!otherUtterance) return; // this product doesn't have a second utterance to check
    const cleaned = otherUtterance.replace(/[.?!]$/, "").trim();
    let found = false;
    for (let salt = 0; salt < 80 && !found; salt++) {
      const copy = localCopy(product, intent, "conversation", salt);
      if (copy.headline === cleaned) found = true;
    }
    assert.ok(found, `expected "${cleaned}" (a real product.utterances entry) to appear as a headline`);
  });

  it("every channel still returns a well-formed GeneratedCopy", () => {
    for (const ch of CHANNELS) {
      const copy = localCopy(product, intent, ch.id, 7);
      assert.equal(copy.channel, ch.id);
      assert.ok(copy.headline.length > 0);
      assert.ok(copy.body.length > 0);
      assert.ok(copy.proofHook.length > 0);
      assert.ok(copy.cta.length > 0);
    }
  });

  it("the proof channel always uses 'Watch the run' as its CTA, same as before", () => {
    for (let salt = 0; salt < 20; salt++) {
      const copy = localCopy(product, intent, "proof", salt);
      assert.equal(copy.cta, "Watch the run");
    }
  });

  it("never produces an empty headline or body even for a product with short catalog fields", () => {
    const sparse = { ...product, queries: [], utterances: [] };
    for (const ch of CHANNELS) {
      for (let salt = 0; salt < 10; salt++) {
        const copy = localCopy(sparse, intent, ch.id, salt);
        assert.ok(copy.headline.trim().length > 0, `empty headline on channel ${ch.id}, salt ${salt}`);
        assert.ok(copy.body.trim().length > 0, `empty body on channel ${ch.id}, salt ${salt}`);
      }
    }
  });
});
