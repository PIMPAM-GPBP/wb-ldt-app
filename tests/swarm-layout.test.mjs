import assert from "node:assert/strict";
import test from "node:test";

import { layoutSwarm, nearestDot, placeSwarm } from "../src/components/analytics/swarm-layout.ts";

// Seeded, so a failure reproduces. Four uniforms summed give a bell around 50, like the pillar scores.
function seededScores(count, seed) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => ({
    id: `u${index}`,
    value: ((next() + next() + next() + next()) / 4) * 100,
  }));
}

function closestPair(dots) {
  let closest = Infinity;
  for (let i = 0; i < dots.length; i += 1) {
    for (let j = i + 1; j < dots.length && dots[j].x - dots[i].x < 12; j += 1) {
      closest = Math.min(closest, Math.hypot(dots[j].x - dots[i].x, dots[j].y - dots[i].y));
    }
  }
  return closest;
}

test("no two dots overlap, including a pile of identical scores", () => {
  const points = [...seededScores(800, 7), ...Array.from({ length: 60 }, (_, i) => ({ id: `tie${i}`, value: 50 }))];
  for (const width of [343, 640, 1000]) {
    // No band cap here: folding overflow back into the band is allowed to overlap, so test placement alone.
    const { dots, radius } = layoutSwarm(points, width, 10000);
    assert.equal(dots.length, points.length);
    assert.ok(closestPair(dots) >= radius * 2, `width ${width}: two dots overlap`);
  }
});

test("x follows the score on a 0 to 100 axis and clamps stray values", () => {
  const { dots, toX } = layoutSwarm(
    [{ id: "low", value: -5 }, { id: "mid", value: 50 }, { id: "high", value: 130 }, { id: "zero", value: 0 }],
    500,
  );
  assert.deepEqual(dots.map((dot) => dot.id), ["low", "zero", "mid", "high"]);
  assert.equal(dots[0].x, toX(0));
  assert.equal(dots[3].x, toX(100));
  assert.equal(toX(50), 250);
  assert.ok(dots.every((dot, index) => index === 0 || dot.x >= dots[index - 1].x));
});

test("the dot radius shrinks until the band fits, and stays at the smallest when nothing fits", () => {
  const points = seededScores(800, 11);
  const wide = layoutSwarm(points, 1000);
  const narrow = layoutSwarm(points, 343);
  assert.ok(narrow.radius < wide.radius, "a narrow plot needs smaller dots");
  assert.ok(wide.half * 2 <= 130 && narrow.half * 2 <= 130, "both bands fit");

  const crowded = layoutSwarm(points, 343, 20);
  assert.equal(crowded.radius, 1.25);
  assert.ok(crowded.half * 2 <= 20, "the band never exceeds its cap");
});

test("a large pile of identical scores stays inside the band", () => {
  const pile = Array.from({ length: 300 }, (_, i) => ({ id: `tie${i}`, value: 42 }));
  const { dots, half } = layoutSwarm([...seededScores(500, 5), ...pile], 640);
  assert.ok(half * 2 <= 130, "band height");
  assert.ok(dots.every((dot) => Math.abs(dot.y) <= 65), "every dot inside the band");
  assert.equal(dots.length, 800);
});

test("rank 1 is the highest score and ties share a rank", () => {
  const values = [10, 40, 40, 90, 90, 90, 55];
  const { dots } = layoutSwarm(values.map((value, index) => ({ id: `p${index}`, value })), 400);
  for (const dot of dots) {
    const higher = values.filter((value) => value > dot.value).length;
    assert.equal(dot.rank, higher + 1, `score ${dot.value}`);
  }
});

test("empty and single inputs lay out without throwing", () => {
  assert.deepEqual(layoutSwarm([], 300).dots, []);
  const single = layoutSwarm([{ id: "only", value: 72 }], 300);
  assert.equal(single.dots[0].y, 0);
  assert.equal(single.dots[0].rank, 1);
  assert.deepEqual(placeSwarm([], 3), []);
});

test("nearestDot matches a brute-force search and respects the distance cap", () => {
  const { dots } = layoutSwarm(seededScores(400, 3), 640);
  const queries = [[12, 0], [320, 4], [320, -30], [500, 9], [628, 0], [-40, 0], [900, 0]];
  for (const [x, y] of queries) {
    for (const maxDistance of [3, 10, 40]) {
      let expected = null;
      let bestDistance = maxDistance;
      for (const dot of dots) {
        const distance = Math.hypot(dot.x - x, dot.y - y);
        if (distance <= bestDistance) {
          bestDistance = distance;
          expected = dot;
        }
      }
      const found = nearestDot(dots, x, y, maxDistance);
      assert.equal(found === null ? null : Math.hypot(found.x - x, found.y - y), expected === null ? null : bestDistance);
    }
  }
  assert.equal(nearestDot([], 5, 5, 10), null);
});
