// Regression test for the autopilot lockup: once 5 swarms existed and all
// reached generation 6, autoStep() became a permanent no-op — the cap
// (`swarms.length < 5`) never released because nothing ever un-hijacked a
// swarm, and generation 6 was a dead end with no graduation logic anywhere
// else in the codebase. See the "graduated" branch and retireSwarm in
// store.ts.
//
// Run via `tsx --test`, not the native --experimental-strip-types loader —
// store.ts (via catalog.ts, genome.ts) uses extensionless relative imports
// that only a bundler-aware loader resolves. Same reason genome.test.ts
// isn't in the native-loader test list either.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useSwarmStore } from "./store.ts";

// A fake clock so a long autopilot run doesn't take a long real-world test.
let virtualNow = Date.now();
const realDateNow = Date.now;
function withFakeClock(fn: () => void) {
  Date.now = () => virtualNow;
  try {
    fn();
  } finally {
    Date.now = realDateNow;
  }
}
function advance(ms: number) {
  virtualNow += ms;
}

function runAutopilot(ticks: number, msPerTick = 2000) {
  for (let i = 0; i < ticks; i++) {
    advance(msPerTick);
    useSwarmStore.getState().autoStep();
  }
}

beforeEach(() => {
  virtualNow = Date.now();
  useSwarmStore.getState().resetLab();
});

describe("autopilot roster rotation", () => {
  it("caps concurrently-running swarms at 5, never letting the pile grow unbounded", () => {
    withFakeClock(() => {
      runAutopilot(400);
    });
    const s = useSwarmStore.getState();
    const running = s.swarms.filter((sw) => sw.running);
    assert.equal(running.length, 5, "should never run more than 5 swarms concurrently");
  });

  it("retires a graduated swarm instead of freezing it — this is the bug fix", () => {
    withFakeClock(() => {
      runAutopilot(400);
    });
    const s = useSwarmStore.getState();
    const retiredCount = s.swarms.filter((sw) => sw.retired).length;
    assert.ok(
      retiredCount > 0,
      "at least one gen-6 swarm should have auto-retired by now — before the fix this was always 0",
    );
  });

  it("keeps introducing new products well past the old 5-SKU ceiling on a long run", () => {
    withFakeClock(() => {
      runAutopilot(3000);
    });
    const s = useSwarmStore.getState();
    const distinctSkus = new Set(s.organisms.map((o) => o.sku));
    assert.ok(
      distinctSkus.size > 5,
      `expected more than 5 distinct products to ever be hijacked over a long run, got ${distinctSkus.size} — the old bug capped this at exactly 5 forever`,
    );
    assert.equal(
      s.swarms.filter((sw) => sw.running).length,
      5,
      "should still only run 5 swarms concurrently — this is rotation, not an uncapped pile-up",
    );
  });

  it("never kills a live organism, even when its swarm graduates and retires", () => {
    withFakeClock(() => {
      runAutopilot(300);
    });
    const s = useSwarmStore.getState();
    const target = s.swarms[0]!;
    const org = s.organisms.find((o) => o.swarmId === target.id)!;
    useSwarmStore.getState().goLive(org.id);
    withFakeClock(() => {
      runAutopilot(200);
    });
    const after = useSwarmStore.getState();
    const stillLive = after.organisms.find((o) => o.id === org.id)!;
    assert.equal(stillLive.status, "live", "a live organism must never be auto-killed by retirement");
  });

  it("does not resurrect a retired swarm when autopilot is toggled off then on", () => {
    withFakeClock(() => {
      runAutopilot(400); // get to 5 swarms, all graduated + retired
    });
    const before = useSwarmStore.getState();
    const retiredIds = new Set(before.swarms.filter((sw) => sw.retired).map((sw) => sw.id));
    assert.ok(retiredIds.size > 0, "sanity check: something should have retired by now");

    useSwarmStore.getState().setAutopilot(false);
    useSwarmStore.getState().setAutopilot(true);

    const after = useSwarmStore.getState();
    for (const id of retiredIds) {
      const sw = after.swarms.find((s) => s.id === id)!;
      assert.equal(
        sw.running,
        false,
        "flipping the global autopilot switch must not bulk-resume a retired swarm — that would instantly refill the cap with already-tried products",
      );
    }
  });

  it("a manual pause (not retirement) still resumes normally when autopilot is toggled back on", () => {
    const s = useSwarmStore.getState();
    const swarmId = s.swarms[0]!.id;
    useSwarmStore.getState().toggleRun(swarmId); // manual pause, not retirement
    useSwarmStore.getState().setAutopilot(false);
    useSwarmStore.getState().setAutopilot(true);
    const after = useSwarmStore.getState();
    const sw = after.swarms.find((x) => x.id === swarmId)!;
    assert.equal(sw.running, true, "an ordinary manual pause should resume with the rest when autopilot restarts");
    assert.ok(!sw.retired, "a manually paused swarm was never retired in the first place");
  });
});
