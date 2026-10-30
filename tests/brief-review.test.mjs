import assert from "node:assert/strict";
import test from "node:test";

import { contentHash, sectionCommitments, undecided, visibility } from "../src/lib/brief/review.ts";

// Failure modes:
// 1. The public sees model-derived sections that nobody reviewed (decision 3).
// 2. A section reviewed once still shows as reviewed after its content changed.
// 3. A withheld section reaches anyone outside the review console.
// 4. A rejected commitment appears in a draft or a reviewed section.
// 5. A reviewer's corrected components are ignored.
// 6. A pillar is marked reviewed while some of its commitments are undecided.

const commitment = (id, components, review = null) => ({
  id,
  quote: `Commitment ${id}`,
  page: 3,
  citedPage: 3,
  english: null,
  components,
  kind: "project",
  strength: "specific",
  match: "exact",
  similarity: 1,
  planId: "zmb-plan",
  planUrl: "https://example.test/plan.pdf",
  planTitle: "Plan",
  review,
});
const accept = (components = null) => ({ decision: "accepted", components, reviewedAt: "2026-11-02T10:00:00Z" });
const reject = () => ({ decision: "rejected", components: null, reviewedAt: "2026-11-02T10:00:00Z" });
const prosperity = ["luminosity_per_capita", "luminosity_per_area", "built_area_development", "tourism", "agricultural_land"];

test("without a matching review the public sees 'in review'", () => {
  assert.deepEqual(visibility(null, "hash"), { kind: "in review" });
  const reviewed = { status: "reviewed", reviewedAt: "2026-11-02", contentHash: "hash", note: null };
  assert.deepEqual(visibility(reviewed, "hash"), { kind: "reviewed", reviewedAt: "2026-11-02" });
});

test("a review stops counting once the content it covered changes", () => {
  const before = [commitment("a", ["tourism"], accept())];
  const after = [...before, commitment("b", ["tourism"], accept())];
  const hash = contentHash("prosperity", 2, before, prosperity);
  assert.notEqual(hash, contentHash("prosperity", 2, after, prosperity));
  assert.notEqual(hash, contentHash("prosperity", 3, before, prosperity));
  // A commitment on another pillar's components does not reopen this one.
  assert.equal(hash, contentHash("prosperity", 2, [...before, commitment("c", ["air_quality"], accept())], prosperity));
  const review = { status: "reviewed", reviewedAt: "2026-11-02", contentHash: hash, note: null };
  assert.deepEqual(visibility(review, contentHash("prosperity", 2, after, prosperity)), { kind: "in review" });
});

test("a withheld section stays withheld even though its content still matches", () => {
  const withheld = { status: "withheld", reviewedAt: "2026-11-02", contentHash: "hash", note: "Wrong plan" };
  assert.deepEqual(visibility(withheld, "hash"), { kind: "withheld" });
});

test("rejected commitments never appear, and the reviewed view holds only accepted ones", () => {
  const all = [commitment("a", ["tourism"], accept()), commitment("b", ["tourism"], reject()), commitment("c", ["tourism"])];
  assert.deepEqual(sectionCommitments(all, "draft").map((entry) => entry.id), ["a", "c"]);
  assert.deepEqual(sectionCommitments(all, "reviewed").map((entry) => entry.id), ["a"]);
});

test("a reviewer's corrected components replace the model's", () => {
  const corrected = sectionCommitments([commitment("a", ["emissions", "air_quality"], accept(["deforestation"]))], "reviewed");
  assert.deepEqual(corrected[0].components, ["deforestation"]);
});

test("undecided commitments on a pillar are listed so the pillar cannot be marked reviewed", () => {
  const all = [commitment("a", ["tourism"], accept()), commitment("b", ["tourism"]), commitment("c", ["air_quality"])];
  assert.deepEqual(undecided(all, prosperity).map((entry) => entry.id), ["b"]);
});
